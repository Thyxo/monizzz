import { db, userSelect } from '@/lib/db';
import { ApiError, authed } from '@/lib/route';

export const GET = authed('Me', async (_request, user) => {
  const fullUser = await db.user.findUnique({
    where: { id: user.userId },
    select: userSelect,
  });
  // The token outlived the user: treat it as logged out.
  if (!fullUser) throw new ApiError(401, 'Ikke logget ind');
  return { user: fullUser };
});
