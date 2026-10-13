import { db } from '@/lib/db';
import { ApiError, authed, parseBody } from '@/lib/route';
import { accountOrderSchema } from '@/lib/validation';

// Sets the order of the user's accounts: each id gets its position in the list as sortOrder.
export const PUT = authed('Reorder accounts', async (request, user) => {
  const { ids } = await parseBody(request, accountOrderSchema);
  const owned = await db.account.findMany({ where: { userId: user.userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((account) => account.id));
  if (new Set(ids).size !== ids.length || ids.some((id) => !ownedIds.has(id))) {
    throw new ApiError(400, 'Ugyldig rækkefølge');
  }
  await db.$transaction(
    ids.map((id, position) =>
      db.account.updateMany({ where: { id, userId: user.userId }, data: { sortOrder: position } }),
    ),
  );
  return { success: true };
});
