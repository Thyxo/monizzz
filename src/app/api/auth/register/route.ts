import { db } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { ApiError, open, parseBody } from '@/lib/route';
import { credentialsSchema } from '@/lib/validation';

export const POST = open('Register', async (request) => {
  rateLimit(request, 'register', 10, 60 * 60 * 1000);
  const { username, password } = await parseBody(request, credentialsSchema);

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) throw new ApiError(409, 'Brugernavn er allerede i brug');

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { username, passwordHash } });

  const token = await createToken(user.id, user.username);
  return {
    token,
    user: { id: user.id, username: user.username, themeAccentColor: user.themeAccentColor, themeBgColor: user.themeBgColor },
  };
});
