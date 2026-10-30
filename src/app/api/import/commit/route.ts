import { db } from '@/lib/db';
import { postEntry, resolveCategoryId } from '@/lib/ledger';
import { ApiError, authed, parseBody } from '@/lib/route';
import { importCommitSchema } from '@/lib/validation';

// Books the rows approved on the import review screen, all or nothing.
export const POST = authed(
  'Commit import',
  async (request, user) => {
    const { accountId, rows } = await parseBody(request, importCommitSchema);
    const created = await db.$transaction(
      async (tx) => {
        const account = await tx.account.findFirst({ where: { id: accountId, userId: user.userId } });
        if (!account) throw new ApiError(404, 'Konto ikke fundet');
        let count = 0;
        for (const row of rows) {
          const categoryId = await resolveCategoryId(tx, user.userId, row.categoryId);
          await postEntry(tx, { accountId, amount: row.amount, note: row.note, categoryId, date: row.date });
          count += 1;
        }
        return count;
      },
      { timeout: 30_000 },
    );
    return { created };
  },
  201,
);
