import { runDueRules } from '@/lib/auto-rules';
import { authed } from '@/lib/route';

// Called by the app on start so due rules are booked without an external scheduler.
export const POST = authed('Run auto rules', async (_request, user) => {
  const results = await runDueRules(user.userId);
  return { runAt: new Date().toISOString(), results };
});
