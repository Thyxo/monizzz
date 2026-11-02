import { db } from '@/lib/db';
import { deleteEntryIn, updateEntryIn } from '@/lib/ledger';
import { authed, parseBody } from '@/lib/route';
import { entryBulkSchema } from '@/lib/validation';

// Deletes or moves several transactions in one go; all of them or none.
export const POST = authed('Bulk transactions', async (request, user) => {
  const body = await parseBody(request, entryBulkSchema);
  const ids = [...new Set(body.ids)];
  const changed = await db.$transaction(
    async (tx) => {
      // Deleting one leg of a transfer deletes both, so the other leg may already be gone.
      const gone = new Set<string>();
      let count = 0;
      for (const id of ids) {
        if (gone.has(id)) continue;
        if (body.action === 'delete') {
          const result = await deleteEntryIn(tx, user.userId, id);
          result.ids.forEach((legId) => gone.add(legId));
        } else {
          await updateEntryIn(tx, user.userId, { id, accountId: body.accountId });
        }
        count += 1;
      }
      return count;
    },
    { timeout: 30_000 },
  );
  return { changed };
});
