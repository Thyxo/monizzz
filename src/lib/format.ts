export function formatAmount(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}${formatted} kr`;
}

export function formatAmountShort(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : '+'}${formatted}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getAccountIcon(type: string): string {
  switch (type) {
    case 'opsparing': return 'S';
    case 'monizz': return 'M';
    case 'donation': return 'D';
    case 'goal_savings': return 'G';
    default: return 'K';
  }
}
