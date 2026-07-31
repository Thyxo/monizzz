import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const accounts = await db.account.findMany({
      where: { userId: user.userId },
      include: { goal: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { name, type, balance, targetAmount } = await request.json();

    if (!name || !type) {
      return NextResponse.json({ error: 'Navn og type kræves' }, { status: 400 });
    }

    const account = await db.account.create({
      data: {
        userId: user.userId,
        name,
        type: type || 'custom',
        balance: balance || 0,
        ...(targetAmount && type === 'goal_savings'
          ? { goal: { create: { targetAmount } } }
          : {}),
      },
      include: { goal: true },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error('Create account error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: ' Konto ID kræves' }, { status: 400 });
    }

    const account = await db.account.findFirst({
      where: { id, userId: user.userId },
    });
    if (!account) {
      return NextResponse.json({ error: 'Konto ikke fundet' }, { status: 404 });
    }

    await db.transaction.deleteMany({ where: { accountId: id } });
    if (account.type === 'goal_savings') {
      await db.goal.deleteMany({ where: { accountId: id } });
    }
    await db.account.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
