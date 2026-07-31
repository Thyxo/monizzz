import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Brugernavn og password kræves' }, { status: 400 });
    }

    if (username.length < 2 || password.length < 4) {
      return NextResponse.json({ error: 'Brugernavn skal være mindst 2 tegn, password mindst 4' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Brugernavn er allerede i brug' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { username, passwordHash },
    });

    const token = await createToken(user.id, user.username);

    return NextResponse.json({
      token,
      user: { id: user.id, username: user.username, themeAccentColor: user.themeAccentColor, themeBgColor: user.themeBgColor },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
