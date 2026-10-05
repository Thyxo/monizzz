import { db } from '@/lib/db';
import { ApiError, authed, parseBody } from '@/lib/route';
import { goalSchema } from '@/lib/validation';

export const PUT = authed('Update goal', async (request, user) => {
  const { accountId, targetAmount } = await parseBody(request, goalSchema);
  const account = await db.account.findFirst({ where: { id: accountId, userId: user.userId } });
  if (!account) throw new ApiError(404, 'Konto ikke fundet');

  const goal = await db.goal.upsert({
    where: { accountId },
    create: { accountId, targetAmount },
    update: { targetAmount },
  });
  return { goal };
});
