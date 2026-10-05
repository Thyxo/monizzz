import { db } from '@/lib/db';
import { authed, parseBody } from '@/lib/route';
import { settingsSchema } from '@/lib/validation';

const select = { id: true, username: true, themeAccentColor: true, themeBgColor: true };

export const GET = authed('Get settings', async (_request, user) => {
  const fullUser = await db.user.findUnique({ where: { id: user.userId }, select });
  return { user: fullUser };
});

export const PUT = authed('Update settings', async (request, user) => {
  const data = await parseBody(request, settingsSchema);
  const updatedUser = await db.user.update({ where: { id: user.userId }, data, select });
  return { user: updatedUser };
});
