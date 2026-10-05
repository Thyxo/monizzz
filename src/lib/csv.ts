import { format } from 'date-fns';
import { txKind } from '@/lib/format';

const KIND_LABELS = { income: 'Indtægt', expense: 'Udgift', transfer: 'Overførsel' };

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Semicolon-separated with decimal comma and a BOM, which is what Danish Excel expects.
export function transactionsToCsv(transactions: any[]): string {
  const rows = [
    ['Dato', 'Tid', 'Konto', 'Type', 'Kategori', 'Note', 'Beløb', 'Automatisk'],
    ...transactions.map((tx) => {
      const date = new Date(tx.createdAt);
      return [
        format(date, 'dd-MM-yyyy'),
        format(date, 'HH:mm'),
        tx.account?.name,
        KIND_LABELS[txKind(tx)],
        tx.category?.name,
        tx.note,
        tx.amount.toFixed(2).replace('.', ','),
        tx.type === 'automatic' ? 'Ja' : 'Nej',
      ];
    }),
  ];
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n');
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
