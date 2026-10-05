import { db } from '@/lib/db';
import { postEntry, postTransfer } from '@/lib/ledger';

const TIME_ZONE = 'Europe/Copenhagen';
// Most bookings one rule makes in a single run; the next run continues from there.
const MAX_CATCH_UP = 366;

export type Ymd = { y: number; m: number; d: number }; // m is 1-12

/** The columns of AutoTransferRule that decide when it books. */
export type RuleSchedule = {
  frequency: string; // daily, weekly, monthly
  interval: number;
  dayOfMonth: number;
  anchorDate: Date | null;
  lastRunAt: Date | null;
  startFrom: Date;
};

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in Copenhagen at the given moment. */
export function toYmd(date: Date): Ymd {
  const parts = Object.fromEntries(partsFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

const key = ({ y, m, d }: Ymd) => y * 10000 + m * 100 + d;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dayNumber = ({ y, m, d }: Ymd) => Math.round(Date.UTC(y, m - 1, d) / 86400000);
function fromDayNumber(n: number): Ymd {
  const date = new Date(n * 86400000);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

// 07:00 UTC is morning in Copenhagen all year, so the booking lands on the due day.
export const ymdToDate = ({ y, m, d }: Ymd) => new Date(Date.UTC(y, m - 1, d, 7, 0, 0));
export const formatYmd = ({ y, m, d }: Ymd) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const isBefore = (a: Ymd, b: Ymd) => key(a) < key(b);

/** Parses "yyyy-MM-dd"; null if it is not a real date. */
export function parseYmd(text: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const ymd = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  return key(fromDayNumber(dayNumber(ymd))) === key(ymd) ? ymd : null;
}

/** The rule's due dates on or after `lower`, oldest first. Never ends. */
function* occurrencesFrom(rule: RuleSchedule, lower: Ymd): Generator<Ymd> {
  const step = Math.max(1, Math.floor(rule.interval) || 1);
  const start = toYmd(rule.startFrom);

  if (rule.frequency === 'daily' || rule.frequency === 'weekly') {
    const anchorDay = dayNumber(rule.anchorDate ? toYmd(rule.anchorDate) : start);
    const days = rule.frequency === 'weekly' ? 7 * step : step;
    for (let k = Math.max(0, Math.ceil((dayNumber(lower) - anchorDay) / days)); ; k++) {
      yield fromDayNumber(anchorDay + k * days);
    }
  } else {
    // Monthly. Without an anchor the rule repeats on dayOfMonth, counted from the month it started in.
    const anchor = rule.anchorDate ? toYmd(rule.anchorDate) : { y: start.y, m: start.m, d: rule.dayOfMonth };
    const anchorIndex = anchor.y * 12 + anchor.m - 1;
    const lowerIndex = lower.y * 12 + lower.m - 1;
    for (let k = Math.max(0, Math.ceil((lowerIndex - anchorIndex) / step)); ; k++) {
      const index = anchorIndex + k * step;
      const y = Math.floor(index / 12);
      const m = (index % 12) + 1;
      // A day the month does not have (the 31st in April) falls on the month's last day.
      const occurrence = { y, m, d: Math.max(1, Math.min(anchor.d, daysInMonth(y, m))) };
      if (key(occurrence) >= key(lower)) yield occurrence;
    }
  }
}

/** The due dates the rule has not booked yet, oldest first, past and future. Never ends. */
function* unbooked(rule: RuleSchedule): Generator<Ymd> {
  const start = toYmd(rule.startFrom);
  const last = rule.lastRunAt ? toYmd(rule.lastRunAt) : null;
  const afterLast = last ? fromDayNumber(dayNumber(last) + 1) : null;
  const lower = afterLast && key(afterLast) > key(start) ? afterLast : start;

  for (const occurrence of occurrencesFrom(rule, lower)) {
    // Before anchorDate existed, lastRunAt was the moment the rule ran, which could be a day
    // off its due date. One booking per calendar month keeps those rules from booking twice.
    if (!rule.anchorDate && last && occurrence.y === last.y && occurrence.m === last.m) continue;
    yield occurrence;
  }
}

/**
 * The bookings a rule owes right now, oldest first: every due date after its last
 * booking, never before startFrom and never in the future. Missed ones are caught up.
 */
export function pendingDueDates(rule: RuleSchedule, now: Date, limit = MAX_CATCH_UP): Date[] {
  const today = key(toYmd(now));
  const due: Date[] = [];
  for (const occurrence of unbooked(rule)) {
    if (key(occurrence) > today || due.length >= limit) break;
    due.push(ymdToDate(occurrence));
  }
  return due;
}

/** The next date the rule books: an overdue one if it has any, otherwise the next future one. */
export function nextDueDate(rule: RuleSchedule): Ymd {
  for (const occurrence of unbooked(rule)) return occurrence;
  throw new Error('unreachable');
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
          // Claim the due date first; a concurrent run sees count 0 and backs off.
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
