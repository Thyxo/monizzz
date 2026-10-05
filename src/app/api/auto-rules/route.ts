import { db } from '@/lib/db';
import { ApiError, authed, parseBody, requireParam } from '@/lib/route';
import { ruleCreateSchema, ruleUpdateSchema } from '@/lib/validation';

const include = { source: true, dest: true, category: true };

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

export const GET = authed('Get auto rules', async (_request, user) => {
  const rules = await db.autoTransferRule.findMany({
    where: { userId: user.userId },
    include,
    orderBy: { createdAt: 'asc' },
  });
  return { rules };
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
        dayOfMonth: data.dayOfMonth,
        sourceAccountId: data.sourceAccountId || null,
        destAccountId: data.destAccountId || null,
        categoryId: data.categoryId || null,
      },
      include,
    });
    return { rule };
  },
  201,
);

export const PUT = authed('Update auto rule', async (request, user) => {
  const { id, name, amount, dayOfMonth, sourceAccountId, destAccountId, categoryId } = await parseBody(
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
      ...(dayOfMonth !== undefined && { dayOfMonth }),
      ...(sourceAccountId !== undefined && { sourceAccountId: sourceAccountId || null }),
      ...(destAccountId !== undefined && { destAccountId: destAccountId || null }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
    },
    include,
  });
  return { rule };
});

export const DELETE = authed('Delete auto rule', async (request, user) => {
  const id = requireParam(request, 'id', 'Regel ID kræves');
  const existing = await db.autoTransferRule.findFirst({ where: { id, userId: user.userId } });
  if (!existing) throw new ApiError(404, 'Regel ikke fundet');
  await db.autoTransferRule.delete({ where: { id } });
  return { success: true };
});
