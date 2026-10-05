import { format } from 'date-fns';
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
  standard: 'Standard',
  custom: 'Standard',
  opsparing: 'Opsparing',
  monizz: 'Monizz',
  donation: 'Donation',
  goal_savings: 'Mål-konto',
};
