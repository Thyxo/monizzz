import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const fullUser = await db.user.findUnique({
      where: { id: user.userId },
      select: { id: true, username: true, themeAccentColor: true, themeBgColor: true },
    });

    if (!fullUser) {
      return NextResponse.json({ error: 'Bruger ikke fundet' }, { status: 404 });
    }

    return NextResponse.json({ user: fullUser });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
