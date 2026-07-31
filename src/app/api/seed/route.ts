import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST() {
  try {
    // Check if primary user already exists
    const existingUser = await db.user.findFirst({ where: { username: 'yen' } });
    if (existingUser) {
      return NextResponse.json({ message: 'Primary user already exists', userId: existingUser.id });
    }

    const passwordHash = await hashPassword('yen1234');

    const user = await db.user.create({
      data: {
        username: 'yen',
        passwordHash,
        themeAccentColor: '#10b981',
        themeBgColor: '#0a0a0a',
      },
    });

    const opsparing = await db.account.create({
      data: {
        userId: user.id,
        name: 'Opsparing',
        type: 'opsparing',
        balance: 9000,
      },
    });

    const bornePenge = await db.account.create({
      data: {
        userId: user.id,
        name: 'Børnepenge',
        type: 'standard',
        balance: 20000,
      },
    });

    const monizz = await db.account.create({
      data: {
        userId: user.id,
        name: 'Mine egne monizz',
        type: 'monizz',
        balance: 4971,
      },
    });

    const donation = await db.account.create({
      data: {
        userId: user.id,
        name: 'Donation',
        type: 'donation',
        balance: 0,
      },
    });

    // Auto rule: Opsparing +250 from Mine egne monizz
    await db.autoTransferRule.create({
      data: {
        userId: user.id,
        name: 'Opsparing',
        amount: 250,
        dayOfMonth: 1,
        sourceAccountId: monizz.id,
        destAccountId: opsparing.id,
      },
    });

    // Auto rule: Donation -50 from Mine egne monizz
    await db.autoTransferRule.create({
      data: {
        userId: user.id,
        name: 'Donation',
        amount: 50,
        dayOfMonth: 1,
        sourceAccountId: monizz.id,
        destAccountId: null,
      },
    });

    return NextResponse.json({
      message: 'Seed data created successfully',
      userId: user.id,
      username: 'yen',
      password: 'yen1234',
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Der opstod en fejl' }, { status: 500 });
  }
}
