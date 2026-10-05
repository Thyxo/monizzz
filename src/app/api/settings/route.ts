import { db, userSelect as select } from '@/lib/db';
import { ApiError, authed, parseBody } from '@/lib/route';
import { settingsSchema } from '@/lib/validation';

export const GET = authed('Get settings', async (_request, user) => {
  const fullUser = await db.user.findUnique({ where: { id: user.userId }, select });
  return { user: fullUser };
});

export const PUT = authed('Update settings', async (request, user) => {
  const data = await parseBody(request, settingsSchema);
  if (data.defaultAccountId) {
    const account = await db.account.findFirst({ where: { id: data.defaultAccountId, userId: user.userId } });
    if (!account) throw new ApiError(404, 'Konto ikke fundet');
  }
  const updatedUser = await db.user.update({ where: { id: user.userId }, data, select });
  return { user: updatedUser };
});
