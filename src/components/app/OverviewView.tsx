'use client';

import { createElement, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChartPie, LayoutGrid, PieChart as PieIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/store';
import { useCategories, useMonthTransactions } from '@/lib/queries';
import { UNCATEGORISED, categoryIcon } from '@/lib/icons';
import { formatAmount, txKind } from '@/lib/format';
import { tint } from '@/lib/theme';
import { CategoryIcon, Empty, Header, IconButton, MonthNav, Segmented, SkeletonList } from '@/components/app/ui';

type Row = { id: string; name: string; color: string; icon: string; amount: number; pct: number };

export default function OverviewView() {
  const showTransactions = useAppStore((state) => state.showTransactions);
  const [month, setMonth] = useState(() => new Date());
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [mode, setMode] = useState<'grid' | 'pie'>('grid');
  const { categories } = useCategories();
  const { transactions, isPending } = useMonthTransactions(month);

  const { rows, total } = useMemo(() => {
    const sums = new Map<string, number>();
    for (const tx of transactions) {
      if (txKind(tx) !== kind) continue;
      const id = tx.categoryId || UNCATEGORISED.id;
      sums.set(id, (sums.get(id) || 0) + Math.abs(tx.amount));
    }
    const sum = [...sums.values()].reduce((a, b) => a + b, 0);
    // Every category of this kind is listed, also the ones without activity this month.
    const known: Row[] = categories
      .filter((category) => category.kind === kind || sums.has(category.id))
      .map((category) => ({ ...category, amount: sums.get(category.id) || 0, pct: 0 }));
    if (sums.has(UNCATEGORISED.id)) known.push({ ...UNCATEGORISED, amount: sums.get(UNCATEGORISED.id)!, pct: 0 });
    for (const row of known) row.pct = sum > 0 ? (row.amount / sum) * 100 : 0;
    known.sort((a, b) => b.amount - a.amount);
    return { rows: known, total: sum };
  }, [transactions, categories, kind]);

  const open = (row: Row) => showTransactions({ categoryId: row.id, kind, month: format(month, 'yyyy-MM') });
  const withAmount = rows.filter((row) => row.amount > 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Oversigt"
        right={
          <IconButton
            icon={mode === 'grid' ? PieIcon : LayoutGrid}
            label={mode === 'grid' ? 'Vis diagram' : 'Vis kort'}
            onClick={() => setMode(mode === 'grid' ? 'pie' : 'grid')}
          />
        }
      />
      <div className="shrink-0 space-y-2 px-4 pb-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Udgifter' },
            { value: 'income', label: 'Indtægter' },
          ]}
        />
        <MonthNav month={month} onChange={setMonth} />
      </div>

      <div className="scroll-area px-4 pb-24">
        <div className="mb-4 text-center">
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{kind === 'expense' ? 'Udgifter i alt' : 'Indtægter i alt'}</p>
          <p className="text-3xl font-bold" style={{ color: kind === 'expense' ? 'var(--expense)' : 'var(--income)' }}>
            {formatAmount(total)}
          </p>
        </div>

        {isPending ? (
          <SkeletonList rows={4} />
        ) : rows.length === 0 ? (
          <Empty
            icon={ChartPie}
            title="Intet at vise endnu"
            text="Opret kategorier under Mere → Kategorier, og vælg en kategori, når du tilføjer en transaktion."
          />
        ) : mode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {rows.map((row) => {
              return (
                <button
                  key={row.id}
                  onClick={() => open(row)}
                  className="pressable rounded-2xl p-4 text-left"
                  style={{ backgroundColor: tint(row.color, 0.16), border: `1px solid ${tint(row.color, 0.3)}` }}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {createElement(categoryIcon(row.icon), { size: 16, style: { color: row.color }, className: 'shrink-0' })}
                    <span className="truncate">{row.name}</span>
                  </p>
                  <p className="mt-2 truncate text-lg font-bold">{formatAmount(row.amount)}</p>
                  <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{row.pct.toFixed(1).replace('.', ',')}%</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {withAmount.length > 0 ? (
              <div className="mx-auto h-64 w-full max-w-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={withAmount}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius="45%"
                      outerRadius="95%"
                      paddingAngle={withAmount.length > 1 ? 2 : 0}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {withAmount.map((row) => (
                        <Cell key={row.id} fill={row.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>Ingen beløb i denne måned</p>
            )}
            <div className="mt-4 space-y-2">
              {withAmount.map((row) => (
                <button key={row.id} onClick={() => open(row)} className="card pressable flex w-full items-center gap-3 p-3 text-left">
                  <CategoryIcon category={row} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.name}</p>
                    <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {row.pct.toFixed(1).replace('.', ',')}% af {kind === 'expense' ? 'udgifter' : 'indtægter'}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold" style={{ color: row.color }}>{formatAmount(row.amount)}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
