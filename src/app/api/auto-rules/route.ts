import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const rules = await db.autoTransferRule.findMany({
      where: { userId: user.userId },
      include: { source: true, dest: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Get auto rules error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { name, amount, frequency, dayOfMonth, dayOfWeek, sourceAccountId, destAccountId } = await request.json();

    if (!name || !amount) {
      return NextResponse.json({ error: 'Navn og beløb kræves' }, { status: 400 });
    }

    const normalizedFrequency = frequency === 'weekly' ? 'weekly' : 'monthly';
    const normalizedDayOfMonth = Number(dayOfMonth) || 1;
    const normalizedDayOfWeek = Number(dayOfWeek) || 1;

    if (normalizedFrequency === 'monthly' && (normalizedDayOfMonth < 1 || normalizedDayOfMonth > 31)) {
      return NextResponse.json({ error: 'Vælg en dato mellem 1 og 31' }, { status: 400 });
    }

    if (normalizedFrequency === 'weekly' && (normalizedDayOfWeek < 1 || normalizedDayOfWeek > 7)) {
      return NextResponse.json({ error: 'Vælg en ugedag' }, { status: 400 });
    }

    const rule = await db.autoTransferRule.create({
      data: {
        userId: user.userId,
        name,
        amount,
        frequency: normalizedFrequency,
        dayOfMonth: normalizedFrequency === 'monthly' ? normalizedDayOfMonth : 1,
        dayOfWeek: normalizedFrequency === 'weekly' ? normalizedDayOfWeek : null,
        sourceAccountId: sourceAccountId || null,
        destAccountId: destAccountId || null,
      },
      include: { source: true, dest: true },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Create auto rule error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const { id, name, amount, frequency, dayOfMonth, dayOfWeek, sourceAccountId, destAccountId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Regel ID kræves' }, { status: 400 });
    }

    const existingRule = await db.autoTransferRule.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Regel ikke fundet' }, { status: 404 });
    }

    const normalizedFrequency = frequency === 'weekly' ? 'weekly' : frequency === 'monthly' ? 'monthly' : undefined;
    const normalizedDayOfMonth = dayOfMonth !== undefined ? Number(dayOfMonth) : undefined;
    const normalizedDayOfWeek = dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : undefined;

    if (normalizedFrequency === 'monthly' && normalizedDayOfMonth !== undefined && (normalizedDayOfMonth < 1 || normalizedDayOfMonth > 31)) {
      return NextResponse.json({ error: 'Vælg en dato mellem 1 og 31' }, { status: 400 });
    }

    if (normalizedFrequency === 'weekly' && normalizedDayOfWeek !== undefined && (normalizedDayOfWeek < 1 || normalizedDayOfWeek > 7)) {
      return NextResponse.json({ error: 'Vælg en ugedag' }, { status: 400 });
    }

    const rule = await db.autoTransferRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(amount !== undefined && { amount }),
        ...(normalizedFrequency !== undefined && { frequency: normalizedFrequency }),
        ...(normalizedFrequency === 'monthly' && { dayOfWeek: null }),
        ...(normalizedFrequency === 'weekly' && normalizedDayOfWeek === undefined && { dayOfWeek: existingRule.dayOfWeek || 1 }),
        ...(normalizedDayOfMonth !== undefined && { dayOfMonth: normalizedDayOfMonth }),
        ...(normalizedDayOfWeek !== undefined && { dayOfWeek: normalizedDayOfWeek }),
        ...(sourceAccountId !== undefined && { sourceAccountId: sourceAccountId || null }),
        ...(destAccountId !== undefined && { destAccountId: destAccountId || null }),
      },
      include: { source: true, dest: true },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Update auto rule error:', error);
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
      return NextResponse.json({ error: 'Regel ID kræves' }, { status: 400 });
    }

    const existingRule = await db.autoTransferRule.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Regel ikke fundet' }, { status: 404 });
    }

    await db.autoTransferRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete auto rule error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
