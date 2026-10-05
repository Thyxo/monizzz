import { runDueRules } from '@/lib/auto-rules';
import { ApiError, open } from '@/lib/route';

// Optional: lets an external scheduler book due rules for all users.
// The app itself uses POST /api/auto-rules/run, so this is not required.
export const POST = open('Cron run', async (request) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new ApiError(401, 'Unauthorized');

  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (bearerSecret !== cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    throw new ApiError(401, 'Unauthorized');
  }

  const results = await runDueRules();
  return { runAt: new Date().toISOString(), results };
});
