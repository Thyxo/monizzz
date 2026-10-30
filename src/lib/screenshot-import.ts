import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/route';
import { round2 } from '@/lib/validation';

// Cheap and good at reading app screenshots; override with IMPORT_MODEL on Railway if needed.
const MODEL = process.env.IMPORT_MODEL || 'claude-haiku-5-5';

export type ScreenshotImage = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };

export type ScannedRow = {
  date: string | null; // yyyy-MM-dd
  text: string;
  amount: number; // negative = money out
  pending: boolean;
  categoryId: string | null;
};

export type ScanResult = { accountName: string | null; balance: number | null; rows: ScannedRow[] };

const nullable = (type: string, description?: string) => ({
  anyOf: [{ type, ...(description ? { description } : {}) }, { type: 'null' }],
});

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'accountName', 'balance', 'rows'],
  properties: {
    readable: { type: 'boolean', description: 'false if the images are not a list of bank transactions' },
    accountName: nullable('string'),
    balance: nullable('number'),
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'text', 'amount', 'pending', 'categoryId'],
        properties: {
          date: nullable('string', 'yyyy-MM-dd'),
          text: { type: 'string' },
          amount: { type: 'number' },
          pending: { type: 'boolean' },
          categoryId: nullable('string'),
        },
      },
    },
  },
};

const outputSchema = z.object({
  readable: z.boolean(),
  accountName: z.string().nullable(),
  balance: z.number().nullable(),
  rows: z.array(
    z.object({
      date: z.string().nullable(),
      text: z.string(),
      amount: z.number(),
      pending: z.boolean(),
      categoryId: z.string().nullable(),
    }),
  ),
});

function instructions(today: string, categories: { id: string; name: string; kind: string }[]) {
  const categoryList = categories.length
    ? categories.map((c) => `- ${c.id}: ${c.name} (${c.kind === 'income' ? 'indtægt' : 'udgift'})`).join('\n')
    : '(ingen)';
  return `The images are screenshots from a Danish bank app showing one account's transactions. Today is ${today} (Europe/Copenhagen). If there are several images, they are consecutive parts of the same list.

Extract every transaction row that is fully visible, top to bottom, exactly as shown:
- date: the row's date as yyyy-MM-dd. Danish apps write 30/10/2026, 30.10.2026 or "30. okt."; "I dag" is today and "I går" is yesterday; a date heading above several rows (e.g. "Oktober 2026" or "Mandag 27. oktober") applies to the rows under it, and the year comes from such a heading or else is the most recent year that does not put the date in the future. Use null if the date cannot be determined.
- text: the merchant or description as written, including any "..." where the app truncated it. Do not invent or complete text.
- amount: the transaction amount as a plain number with a dot as decimal separator (Danish "1.234,56" is 1234.56). Money out is negative, money in is positive; amounts shown in green or with a "+" are money in. Many apps show the account's running balance under the amount on each row: that is NOT the amount, ignore it.
- pending: true if the row is marked as pending/reserved ("Afventer", "Reserveret", "Ikke bogført") or sits under such a heading.
- categoryId: the id of the best matching category from the list below, only when the match is clear; otherwise null. Money out may only get an expense category and money in an income category.

Skip rows cut off at the top or bottom edge, headings, buttons and other UI.
accountName: the account's name if shown (usually at the top), else null.
balance: the account's current total balance if shown at the top, as a number, else null. Never use a per-row running balance for this.
readable: false if the images do not show a list of bank transactions.

Categories:
${categoryList}`;
}

function copenhagenToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date());
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

export async function scanScreenshots(userId: string, images: ScreenshotImage[]): Promise<ScanResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new ApiError(503, 'Import er ikke sat op på serveren endnu');

  const categories = await db.category.findMany({
    where: { userId },
    select: { id: true, name: true, kind: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const client = new Anthropic();
  let response: Anthropic.Message;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 16000,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((image) => ({
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: image.mediaType, data: image.data },
              })),
              { type: 'text' as const, text: instructions(copenhagenToday(), categories) },
            ],
          },
        ],
      },
      { timeout: 90_000 },
    );
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new ApiError(429, 'Billedlæseren er optaget. Prøv igen om lidt.');
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Screenshot import: invalid ANTHROPIC_API_KEY');
      throw new ApiError(503, 'Import er ikke sat rigtigt op på serveren');
    }
    if (error instanceof Anthropic.BadRequestError) throw new ApiError(400, 'Billedet kunne ikke læses. Prøv et andet screenshot.');
    if (error instanceof Anthropic.APIError) console.error(`Screenshot import: API error ${error.status}`);
    else console.error('Screenshot import failed', error);
    throw new ApiError(502, 'Kunne ikke aflæse billedet. Prøv igen.');
  }

  if (response.stop_reason === 'refusal') throw new ApiError(422, 'Billedet kunne ikke aflæses.');
  if (response.stop_reason === 'max_tokens') throw new ApiError(422, 'For mange posteringer på én gang. Brug færre billeder.');
  const text = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text')?.text;
  let parsed: z.infer<typeof outputSchema>;
  try {
    parsed = outputSchema.parse(JSON.parse(text || ''));
  } catch {
    throw new ApiError(502, 'Kunne ikke aflæse billedet. Prøv igen.');
  }
  if (!parsed.readable) throw new ApiError(422, 'Der blev ikke fundet nogen posteringer på billedet.');

  // Categories the user picked before for the same text win over the model's guess.
  const learned = new Map<string, string>();
  const previous = await db.transaction.findMany({
    where: { account: { userId }, categoryId: { not: null }, note: { not: null } },
    select: { note: true, categoryId: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  for (const tx of previous) {
    const key = normalize(tx.note!);
    if (!learned.has(key)) learned.set(key, tx.categoryId!);
  }
  const kindOf = new Map(categories.map((c) => [c.id, c.kind]));

  const rows: ScannedRow[] = [];
  for (const row of parsed.rows) {
    const amount = round2(row.amount);
    const text = row.text.trim().slice(0, 200);
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000_000) continue;
    const date = row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && !isNaN(Date.parse(row.date)) ? row.date : null;
    const wanted = amount < 0 ? 'expense' : 'income';
    const candidate = learned.get(normalize(text)) ?? row.categoryId;
    const categoryId = candidate && kindOf.get(candidate) === wanted ? candidate : null;
    rows.push({ date, text, amount, pending: row.pending, categoryId });
  }

  return {
    accountName: parsed.accountName?.trim() || null,
    balance: parsed.balance === null ? null : round2(parsed.balance),
    rows,
  };
}
