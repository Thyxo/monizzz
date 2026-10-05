'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, ReceiptText, Search, SlidersHorizontal, X } from 'lucide-react';
import { addMonths, startOfMonth, startOfYear } from 'date-fns';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { api, type TransactionFilter } from '@/lib/api';
import { useAccounts, useCategories, useTransactions } from '@/lib/queries';
import { downloadCsv, transactionsToCsv } from '@/lib/csv';
import { formatMonth, toDateInput } from '@/lib/format';
import { Empty, Header, IconButton, Segmented, SkeletonList, TransactionRow } from '@/components/app/ui';

const PAGE = 100;

type Period = 'all' | 'month' | 'last' | 'year' | string; // string = 'yyyy-MM' from another view

function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date();
  if (period === 'all') return {};
  if (period === 'year') return { from: startOfYear(now).toISOString() };
  const start =
    period === 'month' ? startOfMonth(now) : period === 'last' ? addMonths(startOfMonth(now), -1) : new Date(`${period}-01T00:00:00`);
  return { from: start.toISOString(), to: addMonths(start, 1).toISOString() };
}

export default function TransactionsView() {
  const { openSheet, txPreset, clearTxPreset } = useAppStore();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | 'income' | 'expense' | 'transfer'>(txPreset?.kind || '');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState(txPreset?.categoryId || '');
  const [period, setPeriod] = useState<Period>(txPreset?.month || 'all');
  const [showFilters, setShowFilters] = useState(Boolean(txPreset));
  const [limit, setLimit] = useState(PAGE);
  const [exporting, setExporting] = useState(false);

  // The preset from Oversigt is consumed once.
  useEffect(() => {
    if (txPreset) clearTxPreset();
  }, [txPreset, clearTxPreset]);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const filter: TransactionFilter = useMemo(
    () => ({ q, kind, accountId, categoryId, ...periodRange(period) }),
    [q, kind, accountId, categoryId, period],
  );
  const { transactions, total, isPending } = useTransactions({ ...filter, limit });

  const groups = useMemo(() => {
    const result: { month: string; items: any[] }[] = [];
    for (const tx of transactions) {
      const month = formatMonth(new Date(tx.createdAt));
      if (result[result.length - 1]?.month !== month) result.push({ month, items: [] });
      result[result.length - 1].items.push(tx);
    }
    return result;
  }, [transactions]);

  const activeFilters = [kind, accountId, categoryId, period !== 'all' && period].filter(Boolean).length;
  const customMonth = !['all', 'month', 'last', 'year'].includes(period);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const data = await api.transactions.list({ ...filter, limit: 5000 });
      if (data.transactions.length === 0) {
        toast.info('Ingen transaktioner at eksportere');
        return;
      }
      downloadCsv(`monizzz-${toDateInput(new Date())}.csv`, transactionsToCsv(data.transactions));
      toast.success(`${data.transactions.length} transaktioner eksporteret`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setKind('');
    setAccountId('');
    setCategoryId('');
    setPeriod('all');
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Transaktioner"
        right={
          <>
            <IconButton icon={Download} label="Eksportér CSV" onClick={exportCsv} disabled={exporting} />
            <IconButton
              icon={SlidersHorizontal}
              label="Filtre"
              accent={showFilters || activeFilters > 0}
              onClick={() => setShowFilters(!showFilters)}
            />
          </>
        }
      />

      <div className="shrink-0 space-y-2 px-4 pb-3">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
          <input
            className="field"
            style={{ paddingLeft: '2.75rem', paddingRight: '2.5rem' }}
            placeholder="Søg i noter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              aria-label="Ryd søgning"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--fg-muted)' }}
              onClick={() => setSearch('')}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {showFilters && (
          <div className="space-y-2">
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: '', label: 'Alle' },
                { value: 'expense', label: 'Udgifter' },
                { value: 'income', label: 'Indtægter' },
                { value: 'transfer', label: 'Overførsler' },
              ]}
            />
            <div className="grid grid-cols-3 gap-2">
              <select className="field text-sm" style={{ padding: '0.6rem 0.75rem' }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Alle konti</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <select className="field text-sm" style={{ padding: '0.6rem 0.75rem' }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Alle kategorier</option>
                <option value="none">Ukategoriseret</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select className="field text-sm" style={{ padding: '0.6rem 0.75rem' }} value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="all">Al tid</option>
                <option value="month">Denne måned</option>
                <option value="last">Sidste måned</option>
                <option value="year">I år</option>
                {customMonth && <option value={period}>{formatMonth(new Date(`${period}-01T00:00:00`))}</option>}
              </select>
            </div>
            {activeFilters > 0 && (
              <button className="text-xs font-semibold" style={{ color: 'var(--accent)' }} onClick={resetFilters}>
                Nulstil filtre
              </button>
            )}
          </div>
        )}
      </div>

      <div className="scroll-area px-4 pb-24">
        {isPending ? (
          <SkeletonList rows={7} />
        ) : transactions.length === 0 ? (
          <Empty
            icon={ReceiptText}
            title={q || activeFilters ? 'Ingen resultater' : 'Ingen transaktioner endnu'}
            text={q || activeFilters ? 'Prøv at ændre søgning eller filtre.' : 'Tryk på + for at tilføje din første indtægt eller udgift.'}
          />
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.month} className="mb-4">
                <p className="label mb-2">{group.month}</p>
                <div className="space-y-2">
                  {group.items.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} onClick={() => openSheet({ transaction: tx })} />
                  ))}
                </div>
              </div>
            ))}
            {transactions.length < total && (
              <button className="btn btn-soft w-full" onClick={() => setLimit(limit + PAGE)}>
                Vis flere ({total - transactions.length})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
