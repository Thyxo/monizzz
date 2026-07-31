import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { sourceAccountId, destAccountId, amount, note } = await request.json();

    if (!sourceAccountId || !destAccountId || !amount) {
      return NextResponse.json({ error: 'Kilde, modtager og beløb kræves' }, { status: 400 });
    }

    if (sourceAccountId === destAccountId) {
      return NextResponse.json({ error: 'Kilde og modtager skal være forskellige' }, { status: 400 });
    }

    const sourceAccount = await db.account.findFirst({
      where: { id: sourceAccountId, userId: user.userId },
    });
    const destAccount = await db.account.findFirst({
      where: { id: destAccountId, userId: user.userId },
    });

    if (!sourceAccount) {
      return NextResponse.json({ error: 'Kildekonto ikke fundet' }, { status: 404 });
    }
    if (!destAccount) {
      return NextResponse.json({ error: 'Modtagerkonto ikke fundet' }, { status: 404 });
    }

    const transferId = uuidv4();
    const transferNote = note || `Overførsel: ${sourceAccount.name} → ${destAccount.name}`;

    const [updatedSource, updatedDest, srcTx, destTx] = await db.$transaction([
      db.account.update({
        where: { id: sourceAccountId },
        data: { balance: { decrement: amount } },
      }),
      db.account.update({
        where: { id: destAccountId },
        data: { balance: { increment: amount } },
      }),
      db.transaction.create({
        data: {
          accountId: sourceAccountId,
          amount: -amount,
          type: 'manual',
          note: `${transferNote} (udgående)`,
          transferId,
        },
      }),
      db.transaction.create({
        data: {
          accountId: destAccountId,
          amount: amount,
          type: 'manual',
          note: `${transferNote} (indgående)`,
          transferId,
        },
      }),
    ]);

    return NextResponse.json({ sourceAccount: updatedSource, destAccount: updatedDest, srcTx, destTx });
  } catch (error) {
    console.error('Transfer error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
