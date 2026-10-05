import { db, userSelect } from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { ApiError, open, parseBody } from '@/lib/route';
import { loginSchema } from '@/lib/validation';

export const POST = open('Login', async (request) => {
  rateLimit(request, 'login', 20, 10 * 60 * 1000);
  const { username, password } = await parseBody(request, loginSchema);

  const user = await db.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, 'Forkert brugernavn eller password');
  }

  const token = await createToken(user.id, user.username);
  return {
    token,
    user: Object.fromEntries(Object.keys(userSelect).map((key) => [key, user[key]])),
  };
});
