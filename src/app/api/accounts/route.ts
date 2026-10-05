import { db } from '@/lib/db';
import { ApiError, authed, parseBody, requireParam } from '@/lib/route';
import { accountCreateSchema, accountUpdateSchema } from '@/lib/validation';

export const GET = authed('Get accounts', async (_request, user) => {
  const accounts = await db.account.findMany({
    where: { userId: user.userId },
    include: { goal: true },
    orderBy: { createdAt: 'asc' },
  });
  return { accounts };
});

export const POST = authed(
  'Create account',
  async (request, user) => {
    const { name, type, balance, targetAmount } = await parseBody(request, accountCreateSchema);
    const account = await db.account.create({
      data: {
        userId: user.userId,
        name,
        type,
        balance: balance || 0,
        ...(targetAmount && type === 'goal_savings' ? { goal: { create: { targetAmount } } } : {}),
      },
      include: { goal: true },
    });
    return { account };
  },
  201,
);

export const PUT = authed('Update account', async (request, user) => {
  const { id, name } = await parseBody(request, accountUpdateSchema);
  const existing = await db.account.findFirst({ where: { id, userId: user.userId } });
  if (!existing) throw new ApiError(404, 'Konto ikke fundet');
  const account = await db.account.update({ where: { id }, data: { name }, include: { goal: true } });
  return { account };
});

export const DELETE = authed('Delete account', async (request, user) => {
  const id = requireParam(request, 'id', 'Konto ID kræves');
  const account = await db.account.findFirst({ where: { id, userId: user.userId } });
  if (!account) throw new ApiError(404, 'Konto ikke fundet');

  // Transactions and goal go with the account (cascade); rules keep running without it (set null).
  await db.account.delete({ where: { id } });
  return { success: true };
});
