import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/route';
import { round2 } from '@/lib/validation';

type Tx = Prisma.TransactionClient;

export const entryInclude = {
  category: true,
  account: { select: { id: true, name: true, type: true } },
} satisfies Prisma.TransactionInclude;

const OUT_SUFFIX = ' (udgående)';
const IN_SUFFIX = ' (indgående)';

async function requireAccount(tx: Tx, userId: string, accountId: string, message = 'Konto ikke fundet') {
  const account = await tx.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new ApiError(404, message);
  return account;
}

export async function resolveCategoryId(tx: Tx, userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const category = await tx.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new ApiError(404, 'Kategori ikke fundet');
  return category.id;
}

// Every balance change goes through postEntry/postTransfer so that the balance
// and its Transaction row are always written together.
export async function postEntry(
  tx: Tx,
  data: {
    accountId: string;
    amount: number;
    note?: string | null;
    categoryId?: string | null;
    date?: Date | null;
    type?: 'manual' | 'automatic';
  },
) {
  await tx.account.update({
    where: { id: data.accountId },
    data: { balance: { increment: data.amount } },
  });
  return tx.transaction.create({
    data: {
      accountId: data.accountId,
      amount: data.amount,
      type: data.type || 'manual',
      note: data.note || null,
      categoryId: data.categoryId || null,
      ...(data.date ? { createdAt: data.date } : {}),
    },
    include: entryInclude,
  });
}

export async function postTransfer(
  tx: Tx,
  data: {
    sourceAccountId: string;
    destAccountId: string;
    amount: number;
    note: string;
    date?: Date | null;
    type?: 'manual' | 'automatic';
  },
) {
  const transferId = uuidv4();
  const common = {
    type: data.type || 'manual',
    transferId,
    ...(data.date ? { createdAt: data.date } : {}),
  };
  await tx.account.update({
    where: { id: data.sourceAccountId },
    data: { balance: { decrement: data.amount } },
  });
  await tx.account.update({
    where: { id: data.destAccountId },
    data: { balance: { increment: data.amount } },
  });
  const srcTx = await tx.transaction.create({
    data: { ...common, accountId: data.sourceAccountId, amount: -data.amount, note: data.note + OUT_SUFFIX },
    include: entryInclude,
  });
  const destTx = await tx.transaction.create({
    data: { ...common, accountId: data.destAccountId, amount: data.amount, note: data.note + IN_SUFFIX },
    include: entryInclude,
  });
  return { transferId, srcTx, destTx };
}

export function createEntry(
  userId: string,
  input: { accountId: string; amount: number; note?: string | null; categoryId?: string | null; date?: Date | null },
) {
  return db.$transaction(async (tx) => {
    await requireAccount(tx, userId, input.accountId);
    const categoryId = await resolveCategoryId(tx, userId, input.categoryId);
    const transaction = await postEntry(tx, { ...input, categoryId });
    const account = await tx.account.findUnique({ where: { id: input.accountId }, include: { goal: true } });
    return { account, transaction };
  });
}

export function createTransfer(
  userId: string,
  input: { sourceAccountId: string; destAccountId: string; amount: number; note?: string | null; date?: Date | null },
) {
  if (input.sourceAccountId === input.destAccountId) {
    throw new ApiError(400, 'Kilde og modtager skal være forskellige');
  }
  return db.$transaction(async (tx) => {
    const source = await requireAccount(tx, userId, input.sourceAccountId, 'Kildekonto ikke fundet');
    const dest = await requireAccount(tx, userId, input.destAccountId, 'Modtagerkonto ikke fundet');
    const note = input.note || `Overførsel: ${source.name} → ${dest.name}`;
    const { srcTx, destTx } = await postTransfer(tx, { ...input, note });
    return { srcTx, destTx };
  });
}

function stripLegSuffix(note: string | null) {
  if (!note) return '';
  if (note.endsWith(OUT_SUFFIX)) return note.slice(0, -OUT_SUFFIX.length);
  if (note.endsWith(IN_SUFFIX)) return note.slice(0, -IN_SUFFIX.length);
  return note;
}

export function updateEntry(
  userId: string,
  input: { id: string; amount?: number; note?: string | null; categoryId?: string | null; date?: Date | null },
) {
  return db.$transaction(async (tx) => {
    const entry = await tx.transaction.findFirst({ where: { id: input.id, account: { userId } } });
    if (!entry) throw new ApiError(404, 'Transaktion ikke fundet');

    // A transfer is edited as a whole: both legs keep the same size, note and date.
    const legs = entry.transferId
      ? await tx.transaction.findMany({ where: { transferId: entry.transferId, account: { userId } } })
      : [entry];
    const isTransfer = Boolean(entry.transferId);
    const categoryId =
      input.categoryId === undefined || isTransfer
        ? undefined
        : await resolveCategoryId(tx, userId, input.categoryId);

    for (const leg of legs) {
      let amount = leg.amount;
      if (input.amount !== undefined) {
        amount = isTransfer ? Math.sign(leg.amount || 1) * Math.abs(input.amount) : input.amount;
      }
      const delta = round2(amount - leg.amount);
      if (delta !== 0) {
        await tx.account.update({ where: { id: leg.accountId }, data: { balance: { increment: delta } } });
      }

      let note: string | null | undefined;
      if (input.note !== undefined) {
        if (isTransfer) {
          const base = input.note || stripLegSuffix(leg.note) || 'Overførsel';
          note = base + (leg.amount < 0 ? OUT_SUFFIX : IN_SUFFIX);
        } else {
          note = input.note || null;
        }
      }

      await tx.transaction.update({
        where: { id: leg.id },
        data: {
          amount,
          ...(note !== undefined ? { note } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(input.date ? { createdAt: input.date } : {}),
        },
      });
    }

    const transaction = await tx.transaction.findUnique({ where: { id: entry.id }, include: entryInclude });
    return { transaction };
  });
}

export function deleteEntry(userId: string, id: string) {
  return db.$transaction(async (tx) => {
    const entry = await tx.transaction.findFirst({ where: { id, account: { userId } } });
    if (!entry) throw new ApiError(404, 'Transaktion ikke fundet');

    const legs = entry.transferId
      ? await tx.transaction.findMany({ where: { transferId: entry.transferId, account: { userId } } })
      : [entry];

    for (const leg of legs) {
      await tx.account.update({ where: { id: leg.accountId }, data: { balance: { decrement: leg.amount } } });
      await tx.transaction.delete({ where: { id: leg.id } });
    }
    return { success: true, deleted: legs.length };
  });
}
