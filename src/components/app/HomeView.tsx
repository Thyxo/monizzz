'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react';
import { startOfDay, startOfMonth, subDays } from 'date-fns';
import { useAppStore } from '@/store';
import { useAccounts, useOnline, useRecentTransactions } from '@/lib/queries';
import { ACCOUNT_TYPE_LABELS, formatAmount, formatNumber, greeting, txKind } from '@/lib/format';
import { tint } from '@/lib/theme';
import { AccountBadge, SkeletonList, TransactionRow } from '@/components/app/ui';

const TREND_DAYS = 30;
// Covers both the 30-day trend and the whole current month.
const FETCH_DAYS = 31;

export default function HomeView() {
  const { user, openSheet, openAccount, setActiveTab } = useAppStore();
  const { accounts, isPending: accountsPending } = useAccounts();
  const { transactions, isPending: txPending } = useRecentTransactions(FETCH_DAYS);
  const online = useOnline();

  const total = accounts.reduce((sum, account) => sum + account.balance, 0);

  const { trend, change, income, expense } = useMemo(() => {
    // Walk backwards from today's total, undoing each day's transactions.
    const today = startOfDay(new Date());
    const byDay = new Map<number, number>();
    for (const tx of transactions) {
      const day = startOfDay(new Date(tx.createdAt)).getTime();
      byDay.set(day, (byDay.get(day) || 0) + tx.amount);
    }
    const points: { balance: number }[] = [];
    let balance = total;
    for (let i = 0; i <= TREND_DAYS; i++) {
      points.unshift({ balance: Math.round(balance * 100) / 100 });
      balance -= byDay.get(subDays(today, i).getTime()) || 0;
    }

    const monthStart = startOfMonth(new Date()).getTime();
    let monthIncome = 0;
    let monthExpense = 0;
    for (const tx of transactions) {
      if (new Date(tx.createdAt).getTime() < monthStart) continue;
      const kind = txKind(tx);
      if (kind === 'income') monthIncome += tx.amount;
      if (kind === 'expense') monthExpense -= tx.amount;
    }
    return { trend: points, change: total - points[0].balance, income: monthIncome, expense: monthExpense };
  }, [transactions, total]);

  const [whole, decimals] = formatNumber(total).split(',');

  return (
    <div className="scroll-area px-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{greeting(user)}</p>
      <h1 className="mb-4 text-2xl font-bold">Budget</h1>

      <div className="card relative overflow-hidden" style={{ backgroundColor: tint(user?.themeAccentColor || '#10b981', 0.1) }}>
        <div className="absolute inset-x-0 bottom-0 h-16 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#trend)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="relative px-5 pb-20 pt-5 text-center">
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--fg-muted)' }}>
            <span>Samlet saldo</span>
            <span>30 dage</span>
          </div>
          {accountsPending ? (
            <div className="skeleton mx-auto mt-3 h-10 w-44" />
          ) : (
            <p className="mt-2 text-4xl font-bold" style={{ color: total < 0 ? 'var(--expense)' : 'var(--fg)' }}>
              {total < 0 ? '-' : ''}
              {whole}
              {decimals && <span className="text-2xl">,{decimals}</span>}
              <span className="ml-1.5 text-xl font-semibold" style={{ color: 'var(--fg-muted)' }}>kr</span>
            </p>
          )}
          <p className="mt-1 text-xs font-medium" style={{ color: change >= 0 ? 'var(--income)' : 'var(--expense)' }}>
            {change >= 0 ? '+' : '-'}
            {formatNumber(change)} kr på 30 dage
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <QuickCard
          label="Indtægt"
          amount={income}
          color="#10b981"
          icon={<ArrowDownLeft size={16} />}
          disabled={!online}
          onAdd={() => openSheet({ kind: 'income' })}
        />
        <QuickCard
          label="Udgift"
          amount={expense}
          color="#ef4444"
          icon={<ArrowUpRight size={16} />}
          disabled={!online}
          onAdd={() => openSheet({ kind: 'expense' })}
        />
      </div>

      <SectionTitle title="Konti" action="Se alle" onAction={() => setActiveTab('accounts')} />
      {accountsPending ? (
        <SkeletonList rows={3} />
      ) : accounts.length === 0 ? (
        <button className="card pressable w-full p-4 text-sm" style={{ color: 'var(--fg-muted)' }} onClick={() => setActiveTab('accounts')}>
          Opret din første konto
        </button>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => openAccount(account.id)}
              className="card pressable w-40 shrink-0 p-4 text-left"
            >
              <AccountBadge type={account.type} size={36} />
              <p className="mt-3 truncate text-sm font-semibold">{account.name}</p>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {ACCOUNT_TYPE_LABELS[account.type] || account.type}
              </p>
              <p className="mt-2 truncate text-base font-bold" style={{ color: account.balance < 0 ? 'var(--expense)' : 'var(--fg)' }}>
                {formatAmount(account.balance)}
              </p>
            </button>
          ))}
        </div>
      )}

      <SectionTitle title="Seneste" action="Se alle" onAction={() => setActiveTab('transactions')} />
      {txPending ? (
        <SkeletonList rows={4} />
      ) : transactions.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>
          Ingen transaktioner de seneste 30 dage
        </p>
      ) : (
        <div className="space-y-2">
          {transactions.slice(0, 6).map((tx) => (
            <TransactionRow key={tx.id} tx={tx} onClick={() => openSheet({ transaction: tx })} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <p className="label">{title}</p>
      <button className="text-xs font-semibold" style={{ color: 'var(--accent)' }} onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function QuickCard({
  label,
  amount,
  color,
  icon,
  onAdd,
  disabled,
}: {
  label: string;
  amount: number;
  color: string;
  icon: React.ReactNode;
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onAdd}
      disabled={disabled}
      className="pressable rounded-2xl p-4 text-left"
      style={{ backgroundColor: tint(color, 0.12), border: `1px solid ${tint(color, 0.35)}` }}
    >
      <div className="flex items-center justify-between" style={{ color }}>
        <span className="flex items-center gap-1.5 text-sm font-semibold">{icon}{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: color, color: '#fff' }}>
          <Plus size={14} />
        </span>
      </div>
      <p className="mt-2 truncate text-lg font-bold" style={{ color }}>{formatAmount(amount)}</p>
      <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>denne måned</p>
    </button>
  );
}
