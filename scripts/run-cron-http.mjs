const rawBaseUrl =
  process.env.CRON_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');

if (!rawBaseUrl) {
  console.error('Missing CRON_URL, NEXT_PUBLIC_API_URL, or RAILWAY_PUBLIC_DOMAIN for cron:run');
  process.exit(1);
}

const baseUrl = rawBaseUrl.replace(/\/$/, '');
const url = new URL('/api/cron/run', baseUrl).toString();
const headers = {};

if (process.env.CRON_SECRET) {
  headers['X-Cron-Secret'] = process.env.CRON_SECRET;
}

try {
  const response = await fetch(url, { method: 'POST', headers });
  const body = await response.text();

  console.log(body);

  if (!response.ok) {
    process.exit(1);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
