import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// Resolved lazily so a build without JWT_SECRET (the Vercel frontend) still works.
let cachedSecret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET mangler');
  }
  cachedSecret = new TextEncoder().encode(secret || 'monizzz-dev-secret');
  return cachedSecret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string, username: string): Promise<string> {
  return new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as { userId: string; username: string };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}
