import { db } from '@/lib/db';
import { postEntry, postTransfer } from '@/lib/ledger';

const TIME_ZONE = 'Europe/Copenhagen';
const MAX_CATCH_UP_MONTHS = 36;

type Ymd = { y: number; m: number; d: number }; // m is 1-12

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toYmd(date: Date): Ymd {
  const parts = Object.fromEntries(partsFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

const key = ({ y, m, d }: Ymd) => y * 10000 + m * 100 + d;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// 07:00 UTC is morning in Copenhagen all year, so the booking lands on the due day.
const toDate = ({ y, m, d }: Ymd) => new Date(Date.UTC(y, m - 1, d, 7, 0, 0));

/**
 * The due dates a rule still owes, oldest first. One per month, on dayOfMonth
 * (clamped to the month's length), after the month of lastRunAt, never before
 * startFrom and never in the future.
 */
export function pendingDueDates(
  rule: { dayOfMonth: number; lastRunAt: Date | null; startFrom: Date },
  now: Date,
): Date[] {
  const today = toYmd(now);
  const start = toYmd(rule.startFrom);
  let { y, m } = start;

  if (rule.lastRunAt) {
    const last = toYmd(rule.lastRunAt);
    const next = last.m === 12 ? { y: last.y + 1, m: 1 } : { y: last.y, m: last.m + 1 };
    if (next.y * 12 + next.m > y * 12 + m) ({ y, m } = next);
  }

  const due: Date[] = [];
  for (let i = 0; i < MAX_CATCH_UP_MONTHS; i++) {
    const candidate = { y, m, d: Math.min(rule.dayOfMonth, daysInMonth(y, m)) };
    if (key(candidate) > key(today)) break;
    if (key(candidate) >= key(start)) due.push(toDate(candidate));
    if (m === 12) {
      y += 1;
      m = 1;
    } else {
      m += 1;
    }
  }
  return due;
}

export type RuleRunResult = {
  rule: string;
  date: string;
  status: 'transferred' | 'outgoing' | 'incoming' | 'error';
};

class AlreadyRun extends Error {}

/** Books everything that is due. Pass a userId to limit it to one user's rules. */
export async function runDueRules(userId?: string, now = new Date()): Promise<RuleRunResult[]> {
  const rules = await db.autoTransferRule.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: 'asc' },
  });
  const results: RuleRunResult[] = [];

  for (const rule of rules) {
    const { sourceAccountId, destAccountId } = rule;
    if (!sourceAccountId && !destAccountId) continue;

    let lastRunAt = rule.lastRunAt;
    for (const dueAt of pendingDueDates(rule, now)) {
      const date = dueAt.toISOString().slice(0, 10);
      try {
        const status = await db.$transaction(async (tx) => {
          // Claim the month first; a concurrent run sees count 0 and backs off.
          const claimed = await tx.autoTransferRule.updateMany({
            where: { id: rule.id, lastRunAt },
            data: { lastRunAt: dueAt },
          });
          if (claimed.count === 0) throw new AlreadyRun();

          if (sourceAccountId && destAccountId) {
            await postTransfer(tx, {
              sourceAccountId,
              destAccountId,
              amount: rule.amount,
              note: `Auto: ${rule.name}`,
              date: dueAt,
              type: 'automatic',
            });
            return 'transferred' as const;
          }
          await postEntry(tx, {
            accountId: (sourceAccountId || destAccountId)!,
            amount: sourceAccountId ? -rule.amount : rule.amount,
            note: `Auto: ${rule.name}`,
            categoryId: rule.categoryId,
            date: dueAt,
            type: 'automatic',
          });
          return sourceAccountId ? ('outgoing' as const) : ('incoming' as const);
        });
        lastRunAt = dueAt;
        results.push({ rule: rule.name, date, status });
      } catch (error) {
        if (error instanceof AlreadyRun) break;
        console.error(`Failed to process rule ${rule.name}:`, error);
        results.push({ rule: rule.name, date, status: 'error' });
        break;
      }
    }
  }

  return results;
}
