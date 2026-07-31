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

    return NextResponse.json({ user: fullUser });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { themeAccentColor, themeBgColor } = await request.json();

    const updatedUser = await db.user.update({
      where: { id: user.userId },
      data: {
        ...(themeAccentColor && { themeAccentColor }),
        ...(themeBgColor && { themeBgColor }),
      },
      select: { id: true, username: true, themeAccentColor: true, themeBgColor: true },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
