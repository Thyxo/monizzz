import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!accountId) {
      return NextResponse.json({ error: 'AccountId kræves' }, { status: 400 });
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.userId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Konto ikke fundet' }, { status: 404 });
    }

    const transactions = await db.transaction.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.transaction.count({ where: { accountId } });

    return NextResponse.json({ transactions, total });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
