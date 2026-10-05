import { db } from '@/lib/db';
import { formatYmd, isBefore, nextDueDate, parseYmd, toYmd, ymdToDate, type RuleSchedule } from '@/lib/auto-rules';
import { ApiError, authed, parseBody, requireParam } from '@/lib/route';
import { ruleCreateSchema, ruleUpdateSchema } from '@/lib/validation';

const include = { source: true, dest: true, category: true };

// The client shows and edits the schedule through nextDate, the date the rule books next.
const withNextDate = <T extends RuleSchedule>(rule: T) => ({ ...rule, nextDate: formatYmd(nextDueDate(rule)) });

async function assertOwned(
  userId: string,
  refs: { sourceAccountId?: string | null; destAccountId?: string | null; categoryId?: string | null },
) {
  const accountIds = [refs.sourceAccountId, refs.destAccountId].filter(Boolean) as string[];
  if (accountIds.length) {
    const owned = await db.account.count({ where: { id: { in: accountIds }, userId } });
    if (owned !== new Set(accountIds).size) throw new ApiError(404, 'Konto ikke fundet');
  }
  if (refs.sourceAccountId && refs.sourceAccountId === refs.destAccountId) {
    throw new ApiError(400, 'Kilde og modtager skal være forskellige');
  }
  if (refs.categoryId) {
    const category = await db.category.findFirst({ where: { id: refs.categoryId, userId } });
    if (!category) throw new ApiError(404, 'Kategori ikke fundet');
  }
}

/**
 * Column values for the schedule in a request, or {} when it leaves the schedule as it is.
 * Sending back the nextDate the rule already has changes nothing, so the client can
 * always submit the whole form.
 */
function scheduleData(
  input: { frequency?: string; interval?: number; nextDate?: string; dayOfMonth?: number },
  existing?: RuleSchedule,
) {
  const current = { frequency: existing?.frequency ?? 'monthly', interval: existing?.interval ?? 1 };
  const frequency = input.frequency ?? current.frequency;
  const interval = input.interval ?? current.interval;

  if (input.nextDate === undefined) {
    if (frequency !== current.frequency || interval !== current.interval) {
      throw new ApiError(400, 'Vælg en dato for første bogføring');
    }
    // Clients from before schedules existed only send a day of the month.
    return input.dayOfMonth !== undefined && !existing?.anchorDate ? { dayOfMonth: input.dayOfMonth } : {};
  }

  const date = parseYmd(input.nextDate);
  if (!date) throw new ApiError(400, 'Ugyldig dato');
  if (
    existing &&
    frequency === existing.frequency &&
    interval === existing.interval &&
    input.nextDate === formatYmd(nextDueDate(existing))
  ) {
    return {};
  }
  if (isBefore(date, toYmd(new Date()))) throw new ApiError(400, 'Datoen kan ikke ligge før i dag');

  return { frequency, interval, anchorDate: ymdToDate(date), dayOfMonth: date.d };
}

export const GET = authed('Get auto rules', async (_request, user) => {
  const rules = await db.autoTransferRule.findMany({
    where: { userId: user.userId },
    include,
    orderBy: { createdAt: 'asc' },
  });
  return { rules: rules.map(withNextDate) };
});

export const POST = authed(
  'Create auto rule',
  async (request, user) => {
    const data = await parseBody(request, ruleCreateSchema);
    await assertOwned(user.userId, data);
    const rule = await db.autoTransferRule.create({
      data: {
        userId: user.userId,
        name: data.name,
        amount: data.amount,
        ...scheduleData(data),
        sourceAccountId: data.sourceAccountId || null,
        destAccountId: data.destAccountId || null,
        categoryId: data.categoryId || null,
      },
      include,
    });
    return { rule: withNextDate(rule) };
  },
  201,
);

export const PUT = authed('Update auto rule', async (request, user) => {
  const { id, name, amount, sourceAccountId, destAccountId, categoryId, ...schedule } = await parseBody(
    request,
    ruleUpdateSchema,
  );
  const existing = await db.autoTransferRule.findFirst({ where: { id, userId: user.userId } });
  if (!existing) throw new ApiError(404, 'Regel ikke fundet');

  await assertOwned(user.userId, {
    sourceAccountId: sourceAccountId === undefined ? existing.sourceAccountId : sourceAccountId,
    destAccountId: destAccountId === undefined ? existing.destAccountId : destAccountId,
    categoryId,
  });

  const rule = await db.autoTransferRule.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(amount !== undefined && { amount }),
      ...scheduleData(schedule, existing),
      ...(sourceAccountId !== undefined && { sourceAccountId: sourceAccountId || null }),
      ...(destAccountId !== undefined && { destAccountId: destAccountId || null }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
    },
    include,
  });
  return { rule: withNextDate(rule) };
});

export const DELETE = authed('Delete auto rule', async (request, user) => {
  const id = requireParam(request, 'id', 'Regel ID kræves');
  const existing = await db.autoTransferRule.findFirst({ where: { id, userId: user.userId } });
  if (!existing) throw new ApiError(404, 'Regel ikke fundet');
  await db.autoTransferRule.delete({ where: { id } });
  return { success: true };
});
