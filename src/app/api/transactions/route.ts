import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createEntry, deleteEntry, entryInclude, updateEntry } from '@/lib/ledger';
import { ApiError, authed, parseBody, requireParam } from '@/lib/route';
import { entryCreateSchema, entryUpdateSchema } from '@/lib/validation';

const MAX_LIMIT = 5000;

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new ApiError(400, 'Ugyldig dato');
  return date;
}

export const GET = authed('Get transactions', async (request, user) => {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const categoryId = searchParams.get('categoryId');
  const kind = searchParams.get('kind');
  const q = searchParams.get('q')?.trim();
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'));
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), MAX_LIMIT);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0);

  const where: Prisma.TransactionWhereInput = {
    account: { userId: user.userId },
    ...(accountId ? { accountId } : {}),
    ...(categoryId ? { categoryId: categoryId === 'none' ? null : categoryId } : {}),
    ...(q ? { note: { contains: q, mode: 'insensitive' } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(kind === 'transfer' ? { transferId: { not: null } } : {}),
    ...(kind === 'income' ? { transferId: null, amount: { gte: 0 } } : {}),
    ...(kind === 'expense' ? { transferId: null, amount: { lt: 0 } } : {}),
  };

  const [transactions, total] = await Promise.all([
    db.transaction.findMany({
      where,
      include: entryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: offset,
    }),
    db.transaction.count({ where }),
  ]);

  return { transactions, total };
});

export const POST = authed(
  'Create transaction',
  async (request, user) => createEntry(user.userId, await parseBody(request, entryCreateSchema)),
  201,
);

export const PUT = authed('Update transaction', async (request, user) =>
  updateEntry(user.userId, await parseBody(request, entryUpdateSchema)),
);

export const DELETE = authed('Delete transaction', async (request, user) =>
  deleteEntry(user.userId, requireParam(request, 'id', 'Transaktions ID kræves')),
);
