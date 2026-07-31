import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Brugernavn og password kræves' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'Forkert brugernavn eller password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Forkert brugernavn eller password' }, { status: 401 });
    }

    const token = await createToken(user.id, user.username);

    return NextResponse.json({
      token,
      user: { id: user.id, username: user.username, themeAccentColor: user.themeAccentColor, themeBgColor: user.themeBgColor },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
