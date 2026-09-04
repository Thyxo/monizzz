import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

type CronResult = {
  rule: string;
  status: 'transferred' | 'outgoing' | 'incoming' | 'skipped' | 'error';
  transferId?: string;
  reason?: string;
  error?: string;
};

function getDayOfWeek(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - getDayOfWeek(start) + 1);
  return start;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

async function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (cronSecret && (bearerToken === cronSecret || headerSecret === cronSecret)) {
    return true;
  }

  if (bearerToken && await verifyToken(bearerToken)) {
    return true;
  }

  return !cronSecret;
}

async function runAutoTransfers() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDayOfWeek = getDayOfWeek(now);
  const currentWeekStart = startOfWeek(now);

  const rules = await db.autoTransferRule.findMany({
    include: { source: true, dest: true },
    orderBy: { createdAt: 'asc' },
  });

  const results: CronResult[] = [];

  for (const rule of rules) {
    const frequency = rule.frequency === 'weekly' ? 'weekly' : 'monthly';
    const ruleDayOfMonth = Math.min(rule.dayOfMonth, daysInMonth(currentYear, currentMonth));
    const ruleDayOfWeek = rule.dayOfWeek || 1;

    if (frequency === 'monthly' && rule.lastRunAt) {
      const lastMonth = rule.lastRunAt.getMonth();
      const lastYear = rule.lastRunAt.getFullYear();
      if (lastMonth === currentMonth && lastYear === currentYear) {
        results.push({ rule: rule.name, status: 'skipped', reason: 'already_ran_this_month' });
        continue;
      }
    }

    if (frequency === 'weekly' && rule.lastRunAt && rule.lastRunAt >= currentWeekStart) {
      results.push({ rule: rule.name, status: 'skipped', reason: 'already_ran_this_week' });
      continue;
    }

    if (frequency === 'monthly' && currentDay < ruleDayOfMonth) {
      results.push({ rule: rule.name, status: 'skipped', reason: 'scheduled_day_not_reached' });
      continue;
    }

    if (frequency === 'weekly' && currentDayOfWeek !== ruleDayOfWeek) {
      results.push({ rule: rule.name, status: 'skipped', reason: 'scheduled_weekday_not_reached' });
      continue;
    }

    if (!rule.sourceAccountId && !rule.destAccountId) {
      results.push({ rule: rule.name, status: 'skipped', reason: 'missing_source_and_destination' });
      continue;
    }

    try {
      const transferId = uuidv4();
      const txDate = frequency === 'weekly'
        ? new Date(currentYear, currentMonth, currentDay, 8, 0, 0)
        : new Date(currentYear, currentMonth, ruleDayOfMonth, 8, 0, 0);

      if (rule.sourceAccountId && rule.destAccountId) {
        await db.$transaction([
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
        continue;
      }

      if (rule.sourceAccountId) {
        await db.$transaction([
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
        continue;
      }

      if (rule.destAccountId) {
        await db.$transaction([
          db.account.update({
            where: { id: rule.destAccountId },
            data: { balance: { increment: rule.amount } },
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

        results.push({ rule: rule.name, status: 'incoming', transferId });
      }
    } catch (txError) {
      console.error(`Failed to process rule ${rule.name}:`, txError);
      results.push({ rule: rule.name, status: 'error', error: String(txError) });
    }
  }

  const executedCount = results.filter((result) =>
    result.status === 'transferred' || result.status === 'outgoing' || result.status === 'incoming'
  ).length;
  const skippedCount = results.filter((result) => result.status === 'skipped').length;

  return {
    runAt: now.toISOString(),
    executedCount,
    skippedCount,
    results,
  };
}

async function handleCronRun(request: NextRequest) {
  try {
    if (!await isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(await runAutoTransfers());
  } catch (error) {
    console.error('Cron run error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCronRun(request);
}

export async function POST(request: NextRequest) {
  return handleCronRun(request);
}
