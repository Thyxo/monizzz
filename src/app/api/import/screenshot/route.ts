import { authed, parseBody } from '@/lib/route';
import { rateLimit } from '@/lib/rate-limit';
import { scanScreenshots } from '@/lib/screenshot-import';
import { screenshotScanSchema } from '@/lib/validation';

// Every scan is a paid model call, so it is limited per user.
const HOUR = 60 * 60 * 1000;

// Reads transactions off bank-app screenshots. Nothing is stored; the app shows the rows for review.
export const POST = authed('Scan screenshot', async (request, user) => {
  rateLimit(request, `import:${user.userId}`, 30, HOUR);
  const { images } = await parseBody(request, screenshotScanSchema);
  return scanScreenshots(user.userId, images);
});
