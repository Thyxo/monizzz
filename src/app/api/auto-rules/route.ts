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

    const { name, amount, dayOfMonth, sourceAccountId, destAccountId } = await request.json();

    if (!name || !amount) {
      return NextResponse.json({ error: 'Navn og beløb kræves' }, { status: 400 });
    }

    const rule = await db.autoTransferRule.create({
      data: {
        userId: user.userId,
        name,
        amount,
        dayOfMonth: dayOfMonth || 1,
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

    const { id, name, amount, dayOfMonth, sourceAccountId, destAccountId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Regel ID kræves' }, { status: 400 });
    }

    const existingRule = await db.autoTransferRule.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existingRule) {
      return NextResponse.json({ error: 'Regel ikke fundet' }, { status: 404 });
    }

    const rule = await db.autoTransferRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(amount !== undefined && { amount }),
        ...(dayOfMonth !== undefined && { dayOfMonth }),
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
