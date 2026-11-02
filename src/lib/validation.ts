import { z } from 'zod';

const MAX_AMOUNT = 1_000_000_000;

export const round2 = (n: number) => Math.round(n * 100) / 100;

const amount = z
  .number({ error: 'Beløb kræves' })
  .refine((n) => Number.isFinite(n) && Math.abs(n) <= MAX_AMOUNT, 'Ugyldigt beløb')
  .transform(round2);

export const signedAmount = amount.refine((n) => n !== 0, 'Beløb må ikke være 0');
export const positiveAmount = amount.refine((n) => n > 0, 'Beløb skal være større end 0');

const id = z.string().min(1).max(64);
const optionalId = id.nullish();
const note = z.string().trim().max(200, 'Noten er for lang').nullish();
const date = z.coerce.date({ error: 'Ugyldig dato' }).nullish();
const name = z.string().trim().min(1, 'Navn kræves').max(60, 'Navnet er for langt');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ugyldig farve');

export const ACCOUNT_TYPES = ['standard', 'opsparing', 'monizz', 'donation', 'custom', 'goal_savings'] as const;

export const credentialsSchema = z.object({
  username: z.string().trim().min(2, 'Brugernavn skal være mindst 2 tegn').max(40, 'Brugernavnet er for langt'),
  password: z.string().min(4, 'Password skal være mindst 4 tegn').max(200),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Brugernavn og password kræves').max(40),
  password: z.string().min(1, 'Brugernavn og password kræves').max(200),
});

export const accountCreateSchema = z.object({
  name,
  type: z.enum(ACCOUNT_TYPES).default('custom'),
  balance: amount.nullish(),
  targetAmount: positiveAmount.nullish(),
});

export const accountUpdateSchema = z.object({
  id,
  name,
});

// Every one of the user's account ids, in the order they should be listed.
export const accountOrderSchema = z.object({
  ids: z.array(id).min(1).max(500),
});

export const entryCreateSchema = z.object({
  accountId: id,
  amount: signedAmount,
  note,
  categoryId: optionalId,
  date,
});

export const entryUpdateSchema = z.object({
  id,
  // Moves the entry to another account.
  accountId: id.optional(),
  amount: signedAmount.optional(),
  note: note.optional(),
  categoryId: optionalId,
  date: date.optional(),
});

// Several transactions at once: delete them, or move them to another account.
export const entryBulkSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), ids: z.array(id).min(1).max(500) }),
  z.object({ action: z.literal('move'), ids: z.array(id).min(1).max(500), accountId: id }),
]);

export const transferSchema = z.object({
  sourceAccountId: id,
  destAccountId: id,
  amount: positiveAmount,
  note,
  date,
});

export const goalSchema = z.object({
  accountId: id,
  targetAmount: positiveAmount,
});

export const settingsSchema = z.object({
  themeAccentColor: hexColor.optional(),
  themeBgColor: hexColor.optional(),
  // Shown on the home screen; "{navn}" is replaced by the username.
  greetingStyle: z.string().trim().min(1, 'Hilsenen må ikke være tom').max(60, 'Hilsenen er for lang').optional(),
  defaultAccountId: id.nullable().optional(),
  hiddenWidgets: z.string().max(100).regex(/^[a-z,]*$/, 'Ugyldigt valg').optional(),
  navTabs: z.string().max(100).regex(/^[a-z,]*$/, 'Ugyldigt valg').optional(),
});

export const categoryCreateSchema = z.object({
  name,
  kind: z.enum(['expense', 'income']),
  color: hexColor,
  icon: z.string().min(1).max(40),
});

export const categoryUpdateSchema = z.object({
  id,
  name: name.optional(),
  color: hexColor.optional(),
  icon: z.string().min(1).max(40).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const dayOfMonth = z.number().int().min(1, 'Dag skal være 1-31').max(31, 'Dag skal være 1-31');

export const RULE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
const frequency = z.enum(RULE_FREQUENCIES, { error: 'Ugyldig hyppighed' });
const interval = z.number().int().min(1, 'Interval skal være 1-365').max(365, 'Interval skal være 1-365');
// A calendar date without a time, "yyyy-MM-dd".
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ugyldig dato');

// A rule's schedule is frequency + interval + nextDate (its first booking). Clients from
// before nextDate existed send dayOfMonth (monthly) or dayOfWeek (weekly) instead.
const schedule = {
  frequency: frequency.optional(),
  interval: interval.optional(),
  nextDate: dateOnly.optional(),
  dayOfMonth: dayOfMonth.optional(),
  dayOfWeek: z.number().int().min(1, 'Vælg en ugedag').max(7, 'Vælg en ugedag').nullish(),
};

export const ruleCreateSchema = z.object({
  name,
  amount: positiveAmount,
  ...schedule,
  sourceAccountId: optionalId,
  destAccountId: optionalId,
  categoryId: optionalId,
});

export const ruleUpdateSchema = z.object({
  id,
  name: name.optional(),
  amount: positiveAmount.optional(),
  ...schedule,
  sourceAccountId: optionalId,
  destAccountId: optionalId,
  categoryId: optionalId,
});

// Screenshots for the import: base64 without the data: prefix, already downscaled by the app.
export const screenshotScanSchema = z.object({
  images: z
    .array(
      z.object({
        mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        data: z.string().min(100).max(3_000_000, 'Billedet er for stort').regex(/^[A-Za-z0-9+/=]+$/, 'Ugyldigt billede'),
      }),
    )
    .min(1, 'Vælg et billede')
    .max(4, 'Højst 4 billeder ad gangen'),
});

// The rows the user approved on the review screen, booked in one go.
export const importCommitSchema = z.object({
  accountId: id,
  rows: z
    .array(
      z.object({
        amount: signedAmount,
        note,
        categoryId: optionalId,
        date: z.coerce.date({ error: 'Ugyldig dato' }),
      }),
    )
    .min(1, 'Vælg mindst én postering')
    .max(300, 'For mange posteringer på én gang'),
});
