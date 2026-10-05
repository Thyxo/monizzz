import { createEntry } from '@/lib/ledger';
import { authed, parseBody } from '@/lib/route';
import { entryCreateSchema } from '@/lib/validation';

// Kept for older clients; same as POST /api/transactions.
export const POST = authed('Add balance', async (request, user) => {
  const input = await parseBody(request, entryCreateSchema);
  return createEntry(user.userId, {
    ...input,
    note: input.note || (input.amount >= 0 ? 'Manuel indbetaling' : 'Manuel hævning'),
  });
});
