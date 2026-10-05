import { createTransfer } from '@/lib/ledger';
import { authed, parseBody } from '@/lib/route';
import { transferSchema } from '@/lib/validation';

export const POST = authed('Transfer', async (request, user) =>
  createTransfer(user.userId, await parseBody(request, transferSchema)),
);
