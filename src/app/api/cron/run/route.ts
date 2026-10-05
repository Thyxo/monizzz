import { verifyToken } from '@/lib/auth';
import { runDueRules } from '@/lib/auto-rules';
import { ApiError, open } from '@/lib/route';

// Optional: lets an external scheduler (npm run cron:run) book due rules for all users.
// The app itself uses POST /api/auto-rules/run, so this is not required.
export const POST = open('Cron run', async (request) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const hasSecret =
    Boolean(cronSecret) && (bearer === cronSecret || request.headers.get('x-cron-secret') === cronSecret);

  // Older clients trigger a run with a user login; that covers only that user's rules.
  const user = hasSecret || !bearer ? null : await verifyToken(bearer);
  if (!hasSecret && !user) throw new ApiError(401, 'Unauthorized');

  const results = await runDueRules(user?.userId);
  return { runAt: new Date().toISOString(), results };
});

export const GET = POST;
