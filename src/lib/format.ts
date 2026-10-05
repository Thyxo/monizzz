import { addDays, format, startOfDay } from 'date-fns';
import { da } from 'date-fns/locale';

const numberFormat = { minimumFractionDigits: 0, maximumFractionDigits: 2 };

export function formatNumber(amount: number): string {
  return Math.abs(amount).toLocaleString('da-DK', numberFormat);
}

export function formatAmount(amount: number): string {
  return `${amount < 0 ? '-' : ''}${formatNumber(amount)} kr`;
}

export function formatAmountShort(amount: number): string {
  return `${amount < 0 ? '-' : '+'}${formatNumber(amount)}`;
}

/** Parses what a user typed, accepting both "1.234,50" and "1234.50". */
export function parseAmount(text: string): number {
  let cleaned = text.replace(/\s|kr/gi, '');
  if (cleaned.includes(',')) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? NaN : Math.round(value * 100) / 100;
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "d. MMM yyyy 'kl.' HH:mm", { locale: da });
}

export function formatDay(dateStr: string | Date): string {
  return format(new Date(dateStr), 'EEEE d. MMM', { locale: da });
}

export function formatMonth(date: Date): string {
  const text = format(date, 'MMMM yyyy', { locale: da });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Value for <input type="date"> in local time. */
export function toDateInput(date: Date | string): string {
  return format(new Date(date), 'yyyy-MM-dd');
}

/** Turns a date-input value into an ISO timestamp, keeping the time of day from `base`. */
export function fromDateInput(value: string, base: Date = new Date()): string {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(base);
  date.setFullYear(y, m - 1, d);
  return date.toISOString();
}

/** A local Date for a "yyyy-MM-dd" value. */
export function fromYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "i dag", "i morgen" or "fre. 9. okt." for a "yyyy-MM-dd" value. */
export function formatUpcoming(value: string): string {
  const date = fromYmd(value);
  const today = startOfDay(new Date());
  if (date.getTime() === today.getTime()) return 'i dag';
  if (date.getTime() === addDays(today, 1).getTime()) return 'i morgen';
  return format(date, date.getFullYear() === today.getFullYear() ? 'EEE d. MMM' : 'EEE d. MMM yyyy', { locale: da });
}

const UNITS: Record<string, string> = { daily: 'dag', weekly: 'uge', monthly: 'måned' };

/** "Hver uge", "Hver anden dag", "Hver 3. måned". */
export function intervalText(frequency: string, interval: number): string {
  const unit = UNITS[frequency] || UNITS.monthly;
  if (interval <= 1) return `Hver ${unit}`;
  return `Hver ${interval === 2 ? 'anden' : `${interval}.`} ${unit}`;
}

/** How an automatic rule repeats: "Hver uge om fredagen", "Hver anden dag", "D. 1. hver måned". */
export function scheduleText(rule: { frequency: string; interval: number; dayOfMonth: number; nextDate: string }): string {
  if (rule.frequency === 'daily') return intervalText('daily', rule.interval);
  if (rule.frequency === 'weekly') {
    return `${intervalText('weekly', rule.interval)} om ${format(fromYmd(rule.nextDate), 'EEEE', { locale: da })}en`;
  }
  return `D. ${rule.dayOfMonth}. ${intervalText('monthly', rule.interval).toLowerCase()}`;
}

export type Kind = 'income' | 'expense' | 'transfer';

export function txKind(tx: { amount: number; transferId?: string | null }): Kind {
  if (tx.transferId) return 'transfer';
  return tx.amount >= 0 ? 'income' : 'expense';
}

export function txTitle(tx: any): string {
  if (tx.note) return tx.note;
  if (tx.category) return tx.category.name;
  return tx.amount >= 0 ? 'Indbetaling' : 'Hævning';
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  standard: 'Konto',
  custom: 'Konto',
  opsparing: 'Opsparing',
  monizz: 'Lommepenge',
  donation: 'Donation',
  goal_savings: 'Mål-konto',
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  opsparing: '#10b981',
  monizz: '#fbbf24',
  donation: '#ef4444',
  goal_savings: '#a855f7',
};

export const accountColor = (type: string) => ACCOUNT_TYPE_COLORS[type] || '#94a3b8';

export const DEFAULT_GREETING = 'Hej, {navn}';

/** The user's greeting for the home screen, with "{navn}" filled in. */
export function greeting(user: { username: string; greetingStyle?: string } | null): string {
  return (user?.greetingStyle || DEFAULT_GREETING).replace('{navn}', user?.username || '');
}

// The sections of the home screen that can be turned off under Indstillinger.
export const HOME_WIDGETS = [
  { key: 'balance', label: 'Samlet saldo og graf' },
  { key: 'quick', label: 'Indtægt og udgift denne måned' },
  { key: 'accounts', label: 'Konti' },
  { key: 'recent', label: 'Seneste transaktioner' },
];

export function hiddenWidgets(user: { hiddenWidgets?: string } | null): string[] {
  return (user?.hiddenWidgets || '').split(',').filter(Boolean);
}
