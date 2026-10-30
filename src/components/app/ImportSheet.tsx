'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { useAccounts, useAction, useCategories, useOnline } from '@/lib/queries';
import { prepareImage } from '@/lib/image';
import { formatAmount, fromDateInput, fromYmd, parseAmount, toDateInput } from '@/lib/format';
import { Sheet } from '@/components/app/ui';

type Row = {
  key: number;
  date: string; // yyyy-MM-dd, '' when the screenshot did not show one
  text: string;
  amount: number;
  pending: boolean;
  categoryId: string | null;
  selected: boolean;
};

type Scan = { accountName: string | null; balance: number | null; rows: Row[] };

const MAX_IMAGES = 4;

const sameName = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/\s+/g, '');
  const y = b.toLowerCase().replace(/\s+/g, '');
  return x === y || (x.length >= 3 && y.includes(x)) || (y.length >= 3 && x.includes(y));
};

export default function ImportSheet() {
  const { importing, closeImport } = useAppStore();
  return (
    <Sheet open={Boolean(importing)} onClose={closeImport} title="Importér fra screenshot">
      {importing && <ImportFlow initialAccountId={importing.accountId} onDone={closeImport} />}
    </Sheet>
  );
}

function ImportFlow({ initialAccountId, onDone }: { initialAccountId?: string; onDone: () => void }) {
  const { user } = useAppStore();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const online = useOnline();
  const fileInput = useRef<HTMLInputElement>(null);

  const fallbackAccount =
    accounts.find((a) => a.id === initialAccountId)?.id ||
    accounts.find((a) => a.id === user?.defaultAccountId)?.id ||
    accounts[0]?.id ||
    '';
  const [chosenAccount, setChosenAccount] = useState<string | null>(initialAccountId || null);
  const accountId = accounts.some((a) => a.id === chosenAccount) ? chosenAccount! : fallbackAccount;
  const account = accounts.find((a) => a.id === accountId);

  const [scan, setScan] = useState<Scan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [reconcile, setReconcile] = useState(false);

  const pickImages = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length > MAX_IMAGES) {
      toast.error(`Vælg højst ${MAX_IMAGES} billeder ad gangen`);
      return;
    }
    setScanning(true);
    try {
      const images = await Promise.all(Array.from(files).map(prepareImage));
      const result = await api.import.scan(images);
      if (result.rows.length === 0) {
        toast.error('Der blev ikke fundet nogen posteringer på billedet');
        return;
      }
      // Pick the account named on the screenshot, unless one was chosen on purpose.
      if (!initialAccountId && result.accountName) {
        const match = accounts.find((a) => sameName(a.name, result.accountName!));
        if (match) setChosenAccount(match.id);
      }
      setScan({
        accountName: result.accountName,
        balance: result.balance,
        rows: result.rows.map((row, key) => ({
          key,
          date: row.date || '',
          text: row.text,
          amount: row.amount,
          pending: row.pending,
          categoryId: row.categoryId,
          // Pending rows come back later as booked ones, so they are left out by default.
          selected: !row.pending && Boolean(row.date),
        })),
      });
      setReconcile(false);
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke aflæse billedet');
    } finally {
      setScanning(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  // Existing transactions on the account over the screenshot's dates, to spot rows already booked.
  const dates = (scan?.rows || []).map((row) => row.date).filter(Boolean).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const existing = useQuery({
    queryKey: ['import-existing', accountId, from, to],
    enabled: Boolean(scan && accountId && from),
    queryFn: () =>
      api.transactions.list({
        accountId,
        from: fromYmd(from).toISOString(),
        to: new Date(fromYmd(to).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        limit: 500,
      }),
  });

  // A row is a duplicate when the account already has a transaction with the same date and amount.
  // Counting keeps two identical purchases on the same day apart: only the extra ones are new.
  const duplicates = useMemo(() => {
    const left = new Map<string, number>();
    for (const tx of existing.data?.transactions || []) {
      const key = `${toDateInput(tx.createdAt)}|${tx.amount.toFixed(2)}`;
      left.set(key, (left.get(key) || 0) + 1);
    }
    const result = new Set<number>();
    for (const row of scan?.rows || []) {
      const key = `${row.date}|${row.amount.toFixed(2)}`;
      const count = left.get(key) || 0;
      if (row.date && count > 0) {
        result.add(row.key);
        left.set(key, count - 1);
      }
    }
    return result;
  }, [existing.data, scan]);

  // Duplicates are deselected once, when they are first known; the user can still tick them.
  const [dedupedFor, setDedupedFor] = useState<string | null>(null);
  const dedupeKey = existing.data ? `${accountId}|${from}|${to}|${scan?.rows.length}` : null;
  if (scan && dedupeKey && dedupeKey !== dedupedFor) {
    setDedupedFor(dedupeKey);
    setScan({ ...scan, rows: scan.rows.map((row) => (duplicates.has(row.key) ? { ...row, selected: false } : row)) });
  }

  const updateRow = (key: number, change: Partial<Row>) =>
    scan && setScan({ ...scan, rows: scan.rows.map((row) => (row.key === key ? { ...row, ...change } : row)) });

  const chosen = (scan?.rows || []).filter((row) => row.selected && row.date);
  const sum = Math.round(chosen.reduce((total, row) => total + row.amount, 0) * 100) / 100;
  const after = account ? Math.round((account.balance + sum) * 100) / 100 : 0;
  const difference = scan?.balance != null && account ? Math.round((scan.balance - after) * 100) / 100 : 0;

  const commit = useAction(
    () => {
      // Imported rows get midday as their time, so the date stays the same in any time zone nearby.
      const noon = new Date();
      noon.setHours(12, 0, 0, 0);
      const rows = chosen.map((row) => ({
        amount: row.amount,
        note: row.text,
        categoryId: row.categoryId,
        date: fromDateInput(row.date, noon),
      }));
      if (reconcile && difference !== 0) {
        rows.push({ amount: difference, note: 'Afstemning', categoryId: null, date: new Date().toISOString() });
      }
      return api.import.commit({ accountId, rows });
    },
    {
      onDone: (result) => {
        toast.success(result.created === 1 ? '1 postering bogført' : `${result.created} posteringer bogført`);
        onDone();
      },
    },
  );

  if (accounts.length === 0) {
    return <p className="pb-4 text-sm" style={{ color: 'var(--fg-muted)' }}>Opret en konto først.</p>;
  }

  const accountPicker = (
    <select className="field" value={accountId} onChange={(e) => setChosenAccount(e.target.value)}>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );

  const input = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={(e) => pickImages(e.target.files)}
    />
  );

  if (!scan) {
    return (
      <div className="space-y-4">
        {input}
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
          Tag et screenshot af posteringerne i din bank-app og vælg det her. Du kan vælge op til {MAX_IMAGES} billeder,
          hvis listen er lang. Du ser alle posteringer, før noget bliver bogført.
        </p>
        <div>
          <p className="label mb-1.5">Konto i monizzz</p>
          {accountPicker}
        </div>
        <button className="btn btn-accent w-full" disabled={scanning || !online} onClick={() => fileInput.current?.click()}>
          {scanning ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Aflæser billedet...
            </>
          ) : (
            <>
              <ImagePlus size={18} /> Vælg screenshot
            </>
          )}
        </button>
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
          Billedet sendes til Anthropic (Claude) for at aflæse tallene og gemmes ikke.
        </p>
      </div>
    );
  }

  const pendingCount = scan.rows.filter((row) => row.pending).length;

  return (
    <div className="space-y-4">
      {input}
      <div>
        <p className="label mb-1.5">Bogfør på konto</p>
        {accountPicker}
        {scan.accountName && account && !sameName(account.name, scan.accountName) && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
            Screenshottet viser kontoen “{scan.accountName}”.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="label">
            {scan.rows.length} posteringer fundet
            {duplicates.size > 0 && ` · ${duplicates.size} findes allerede`}
            {pendingCount > 0 && ` · ${pendingCount} afventer`}
          </p>
          <button
            className="text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
            onClick={() => {
              const all = scan.rows.every((row) => row.selected || !row.date);
              setScan({ ...scan, rows: scan.rows.map((row) => ({ ...row, selected: !all && Boolean(row.date) })) });
            }}
          >
            {scan.rows.every((row) => row.selected || !row.date) ? 'Fravælg alle' : 'Vælg alle'}
          </button>
        </div>
        <div className="space-y-2">
          {scan.rows.map((row) => (
            <ImportRow
              key={row.key}
              row={row}
              duplicate={duplicates.has(row.key)}
              categories={categories}
              open={editing === row.key}
              onToggleOpen={() => setEditing(editing === row.key ? null : row.key)}
              onChange={(change) => updateRow(row.key, change)}
            />
          ))}
        </div>
      </div>

      {scan.balance != null && account && (
        <div className="card space-y-2 p-3 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--fg-muted)' }}>Saldo i banken</span>
            <span className="font-semibold">{formatAmount(scan.balance)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--fg-muted)' }}>I monizzz efter import</span>
            <span className="font-semibold">{formatAmount(after)}</span>
          </div>
          {difference === 0 ? (
            <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--income)' }}>
              <Check size={14} /> Saldoen passer
            </p>
          ) : (
            <label className="flex items-center gap-2 pt-1 text-xs">
              <input type="checkbox" checked={reconcile} onChange={(e) => setReconcile(e.target.checked)} />
              Tilføj en afstemning på {formatAmount(difference)}, så saldoen passer
            </label>
          )}
        </div>
      )}

      <button
        className="btn btn-accent w-full"
        disabled={(chosen.length === 0 && !(reconcile && difference !== 0)) || commit.isPending || !online}
        onClick={() => commit.mutate(undefined)}
      >
        {commit.isPending
          ? 'Bogfører...'
          : `Bogfør ${chosen.length + (reconcile && difference !== 0 ? 1 : 0)} posteringer (${formatAmount(sum + (reconcile ? difference : 0))})`}
      </button>
      <button className="btn btn-soft w-full" disabled={scanning || !online} onClick={() => fileInput.current?.click()}>
        {scanning ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Vælg andre billeder
      </button>
    </div>
  );
}

function ImportRow({
  row,
  duplicate,
  categories,
  open,
  onToggleOpen,
  onChange,
}: {
  row: Row;
  duplicate: boolean;
  categories: any[];
  open: boolean;
  onToggleOpen: () => void;
  onChange: (change: Partial<Row>) => void;
}) {
  const [amountText, setAmountText] = useState(String(row.amount).replace('.', ','));
  const kind = row.amount < 0 ? 'expense' : 'income';
  const category = categories.find((c) => c.id === row.categoryId);
  const tags = [
    duplicate && 'Findes allerede',
    row.pending && 'Afventer',
    !row.date && 'Mangler dato',
  ].filter(Boolean) as string[];

  return (
    <div className="card p-3" style={{ opacity: row.selected ? 1 : 0.6 }}>
      <div className="flex items-center gap-3">
        <button
          aria-label={row.selected ? 'Fravælg' : 'Vælg'}
          disabled={!row.date}
          onClick={() => onChange({ selected: !row.selected })}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: row.selected ? 'var(--accent)' : 'transparent',
            border: row.selected ? 'none' : '2px solid var(--border)',
            color: 'var(--accent-fg)',
          }}
        >
          {row.selected && <Check size={16} />}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={onToggleOpen}>
          <p className="truncate text-sm font-semibold">{row.text}</p>
          <p className="truncate text-xs" style={{ color: 'var(--fg-muted)' }}>
            {row.date ? fromYmd(row.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Ingen dato'}
            {category ? ` · ${category.name}` : ''}
          </p>
          {tags.length > 0 && (
            <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--expense)' }}>{tags.join(' · ')}</p>
          )}
        </button>
        <button
          className="shrink-0 text-right text-sm font-bold"
          style={{ color: row.amount < 0 ? 'var(--fg)' : 'var(--income)' }}
          onClick={onToggleOpen}
        >
          {formatAmount(row.amount)}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <input
            className="field"
            maxLength={200}
            value={row.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="field"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                const value = parseAmount(e.target.value);
                if (Number.isFinite(value) && value !== 0) {
                  const flipped = value < 0 !== row.amount < 0;
                  onChange({ amount: value, ...(flipped ? { categoryId: null } : {}) });
                }
              }}
            />
            <input
              type="date"
              className="field"
              value={row.date}
              onChange={(e) => onChange({ date: e.target.value, ...(e.target.value && !row.date ? { selected: true } : {}) })}
            />
          </div>
          <select
            className="field"
            value={row.categoryId || ''}
            onChange={(e) => onChange({ categoryId: e.target.value || null })}
          >
            <option value="">Ukategoriseret</option>
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
          <button
            className="text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
            onClick={() => {
              const amount = -row.amount;
              setAmountText(String(amount).replace('.', ','));
              onChange({ amount, categoryId: null });
            }}
          >
            {row.amount < 0 ? 'Det er en indbetaling' : 'Det er en udgift'}
          </button>
        </div>
      )}
    </div>
  );
}
