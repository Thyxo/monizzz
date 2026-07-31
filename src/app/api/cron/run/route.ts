import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      const headerSecret = request.headers.get('x-cron-secret');
      const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (bearerSecret !== cronSecret && headerSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const rules = await db.autoTransferRule.findMany({
      include: { source: true, dest: true },
    });

    const results = [];

    for (const rule of rules) {
      // Check if already ran this month
      if (rule.lastRunAt) {
        const lastMonth = rule.lastRunAt.getMonth();
        const lastYear = rule.lastRunAt.getFullYear();
        if (lastMonth === currentMonth && lastYear === currentYear) {
          continue;
        }
      }

      // Check day of month (allow 1 day tolerance)
      if (Math.abs(currentDay - rule.dayOfMonth) > 1) {
        continue;
      }

      try {
        const transferId = uuidv4();
        const txDate = new Date(currentYear, currentMonth, rule.dayOfMonth, 8, 0, 0);

        if (rule.destAccountId && rule.sourceAccountId) {
          // Transfer between two accounts
          const [updatedSource, updatedDest, srcTx, destTx] = await db.$transaction([
            db.account.update({
              where: { id: rule.sourceAccountId },
              data: { balance: { decrement: rule.amount } },
            }),
            db.account.update({
              where: { id: rule.destAccountId },
              data: { balance: { increment: rule.amount } },
            }),
            db.transaction.create({
              data: {
                accountId: rule.sourceAccountId,
                amount: -rule.amount,
                type: 'automatic',
                note: `Auto: ${rule.name} (udgående)`,
                transferId,
                createdAt: txDate,
              },
            }),
            db.transaction.create({
              data: {
                accountId: rule.destAccountId,
                amount: rule.amount,
                type: 'automatic',
                note: `Auto: ${rule.name} (indgående)`,
                transferId,
                createdAt: txDate,
              },
            }),
            db.autoTransferRule.update({
              where: { id: rule.id },
              data: { lastRunAt: now },
            }),
          ]);

          results.push({ rule: rule.name, status: 'transferred', transferId });
        } else if (rule.sourceAccountId && !rule.destAccountId) {
          // Outgoing only (like donation - leaves the system)
          const [updatedSource, srcTx] = await db.$transaction([
            db.account.update({
              where: { id: rule.sourceAccountId },
              data: { balance: { decrement: rule.amount } },
            }),
            db.transaction.create({
              data: {
                accountId: rule.sourceAccountId,
                amount: -rule.amount,
                type: 'automatic',
                note: `Auto: ${rule.name} (udgående)`,
                transferId,
                createdAt: txDate,
              },
            }),
            db.autoTransferRule.update({
              where: { id: rule.id },
              data: { lastRunAt: now },
            }),
          ]);

          results.push({ rule: rule.name, status: 'outgoing', transferId });
        }
      } catch (txError) {
        console.error(`Failed to process rule ${rule.name}:`, txError);
        results.push({ rule: rule.name, status: 'error', error: String(txError) });
      }
    }

    return NextResponse.json({ runAt: now.toISOString(), results });
  } catch (error) {
    console.error('Cron run error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
