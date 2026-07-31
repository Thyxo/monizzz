import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { accountId, targetAmount } = await request.json();

    if (!accountId || targetAmount === undefined) {
      return NextResponse.json({ error: 'AccountId og målbeløb kræves' }, { status: 400 });
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.userId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Konto ikke fundet' }, { status: 404 });
    }

    const goal = await db.goal.upsert({
      where: { accountId },
      create: { accountId, targetAmount },
      update: { targetAmount },
    });

    return NextResponse.json({ goal });
  } catch (error) {
    console.error('Update goal error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
