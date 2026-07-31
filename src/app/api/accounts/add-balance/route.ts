import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { accountId, amount, note } = await request.json();

    if (!accountId || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Konto og beløb kræves' }, { status: 400 });
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.userId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Konto ikke fundet' }, { status: 404 });
    }

    const updatedAccount = await db.account.update({
      where: { id: accountId },
      data: { balance: { increment: amount } },
    });

    const transaction = await db.transaction.create({
      data: {
        accountId,
        amount,
        type: 'manual',
        note: note || (amount >= 0 ? 'Manuel indbetaling' : 'Manuel hævning'),
      },
    });

    return NextResponse.json({ account: updatedAccount, transaction });
  } catch (error) {
    console.error('Add balance error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
