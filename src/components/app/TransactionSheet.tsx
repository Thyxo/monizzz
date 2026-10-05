'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, Delete, Trash2 } from 'lucide-react';
import { useAppStore, type EntryKind, type SheetState } from '@/store';
import { api } from '@/lib/api';
import { useAccounts, useAction, useCategories } from '@/lib/queries';
import { formatAmount, formatNumber, fromDateInput, fromYmd, parseAmount, toDateInput, txKind } from '@/lib/format';
import { tint } from '@/lib/theme';
import { CategoryIcon, ConfirmSheet, Segmented, Sheet } from '@/components/app/ui';

const KIND_OPTIONS: { value: EntryKind; label: string }[] = [
  { value: 'expense', label: 'Udgift' },
  { value: 'income', label: 'Indtægt' },
  { value: 'transfer', label: 'Overførsel' },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];

// The amount is typed on the sheet's own keypad, so the phone keyboard never covers the form.
function pressKey(amount: string, key: string): string {
  if (key === 'back') return amount.slice(0, -1);
  if (key === ',') return amount.includes(',') ? amount : `${amount || '0'},`;
  const [whole, decimals] = amount.split(',');
  if (decimals !== undefined) return decimals.length < 2 ? amount + key : amount;
  if (whole.length >= 9) return amount;
  return whole === '0' ? key : amount + key;
}

// "12345,5" -> "12.345,5"
function displayAmount(amount: string): string {
  if (!amount) return '0';
  const [whole, decimals] = amount.split(',');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimals !== undefined ? `,${decimals}` : '');
}

const stripLeg = (note: string | null | undefined) => (note || '').replace(/ \((udgående|indgående)\)$/, '');

export default function TransactionSheet() {
  const { sheet, closeSheet } = useAppStore();
  // Keep the last content while the sheet animates out; `opened` remounts the form per opening.
  const [shown, setShown] = useState<{ sheet: SheetState; opened: number }>({ sheet: null, opened: 0 });
  if (sheet && sheet !== shown.sheet) setShown({ sheet, opened: shown.opened + 1 });
  const current = sheet || shown.sheet;
  const title = current?.transaction ? 'Rediger transaktion' : 'Ny transaktion';

  return (
    <Sheet open={Boolean(sheet)} onClose={closeSheet} title={title}>
      {current && <TransactionForm key={shown.opened} initial={current} onDone={closeSheet} />}
    </Sheet>
  );
}

function TransactionForm({ initial, onDone }: { initial: NonNullable<SheetState>; onDone: () => void }) {
  const editing = initial.transaction;
  const user = useAppStore((state) => state.user);
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [kind, setKind] = useState<EntryKind>(editing ? txKind(editing) : initial.kind || 'expense');
  const [amount, setAmount] = useState(() => {
    const value = editing ? Math.abs(editing.amount) : initial.amount;
    return value ? formatNumber(value).replace(/\./g, '').replace(/,00$/, '') : '';
  });
  const [accountId, setAccountId] = useState(editing?.accountId || initial.accountId || '');
  const [destId, setDestId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId || null);
  const [date, setDate] = useState(toDateInput(editing?.createdAt || initial.date || new Date()));
  const [note, setNote] = useState(editing ? stripLeg(editing.note) : initial.note || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Date and note are rarely needed, so they stay folded away unless they already hold something.
  const [showDetails, setShowDetails] = useState(Boolean(note || editing || initial.date));

  // Lets a physical keyboard type the amount too.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input, select, textarea')) return;
      const key = event.key === 'Backspace' ? 'back' : event.key === '.' ? ',' : event.key;
      if (KEYS.includes(key)) setAmount((current) => pressKey(current, key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isTransfer = kind === 'transfer';
  const defaultAccountId = accounts.find((account) => account.id === user?.defaultAccountId)?.id || '';
  const selectedAccountId = accountId || defaultAccountId || accounts[0]?.id || '';
  const value = parseAmount(amount);
  const valid =
    value > 0 && Boolean(selectedAccountId) && (!isTransfer || editing || (destId && destId !== selectedAccountId));

  const save = useAction(
    async () => {
      // Only send a date when it was changed, so an edit keeps the original time of day.
      const originalDate = editing ? toDateInput(editing.createdAt) : toDateInput(new Date());
      const isoDate = date !== originalDate ? fromDateInput(date, editing ? new Date(editing.createdAt) : new Date()) : undefined;

      if (editing) {
        return api.transactions.update({
          id: editing.id,
          amount: isTransfer ? value : kind === 'income' ? value : -value,
          note: note.trim() || null,
          ...(isTransfer ? {} : { categoryId }),
          date: isoDate,
        });
      }
      if (isTransfer) {
        return api.accounts.transfer({
          sourceAccountId: selectedAccountId,
          destAccountId: destId,
          amount: value,
          note: note.trim() || undefined,
          date: isoDate,
        });
      }
      return api.transactions.create({
        accountId: selectedAccountId,
        amount: kind === 'income' ? value : -value,
        note: note.trim() || undefined,
        categoryId,
        date: isoDate,
      });
    },
    { success: editing ? 'Transaktion gemt' : isTransfer ? 'Overførsel gennemført' : 'Transaktion tilføjet', onDone },
  );

  const remove = useAction(() => api.transactions.delete(editing.id), { success: 'Transaktion slettet', onDone });

  const kindOptions = editing
    ? KIND_OPTIONS.filter((option) => (option.value === 'transfer') === isTransfer)
    : KIND_OPTIONS;
  const kindCategories = categories.filter((category) => category.kind === kind);
  const amountColor = isTransfer ? 'var(--fg)' : kind === 'income' ? 'var(--income)' : 'var(--expense)';

  return (
    <div className="space-y-3">
      {kindOptions.length > 1 && (
        <Segmented
          value={kind}
          onChange={(next) => {
            setKind(next);
            setCategoryId(null);
          }}
          options={kindOptions}
        />
      )}

      <p className="truncate py-1 text-center text-5xl font-bold" aria-label="Beløb" style={{ color: amountColor, opacity: amount ? 1 : 0.5 }}>
        {displayAmount(amount)}
        <span className="ml-2 text-xl font-semibold" style={{ color: 'var(--fg-muted)' }}>kr</span>
      </p>

      <div>
        <p className="label mb-1.5">{isTransfer ? 'Fra konto' : 'Konto'}</p>
        <select
          className="field"
          value={selectedAccountId}
          onChange={(e) => setAccountId(e.target.value)}
          disabled={Boolean(editing)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({formatAmount(account.balance)})
            </option>
          ))}
        </select>
      </div>

      {isTransfer && !editing && (
        <div>
          <p className="label mb-1.5">Til konto</p>
          <select className="field" value={destId} onChange={(e) => setDestId(e.target.value)}>
            <option value="">Vælg modtagerkonto...</option>
            {accounts
              .filter((account) => account.id !== selectedAccountId)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({formatAmount(account.balance)})
                </option>
              ))}
          </select>
        </div>
      )}

      {!isTransfer && (
        <div>
          <p className="label mb-1.5">Kategori</p>
          {kindCategories.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              Ingen {kind === 'income' ? 'indtægtskategorier' : 'udgiftskategorier'} endnu. Opret dem under Mere → Kategorier.
            </p>
          ) : (
            <div className="h-scroll -mx-5 gap-2 px-5 pb-1">
              {kindCategories.map((category) => {
                const active = category.id === categoryId;
                return (
                  <button
                    key={category.id}
                    onClick={() => setCategoryId(active ? null : category.id)}
                    className="pressable flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-medium"
                    style={{
                      backgroundColor: active ? tint(category.color, 0.25) : 'var(--card)',
                      border: `1px solid ${active ? category.color : 'var(--border)'}`,
                    }}
                  >
                    <CategoryIcon category={category} size={26} />
                    {category.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showDetails ? (
        <div className="flex gap-2">
          <div className="w-40 shrink-0">
            <p className="label mb-1.5">Dato</p>
            <input type="date" className="field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="label mb-1.5">Note</p>
            <input
              className="field"
              placeholder="Valgfrit"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <button
          className="flex w-full items-center gap-2 py-1 text-sm"
          style={{ color: 'var(--fg-muted)' }}
          onClick={() => setShowDetails(true)}
        >
          <CalendarDays size={16} />
          {date === toDateInput(new Date()) ? 'I dag' : fromYmd(date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
          {' · Tilføj dato eller note'}
          <ChevronDown size={16} className="ml-auto" />
        </button>
      )}

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            aria-label={key === 'back' ? 'Slet ciffer' : key}
            className="pressable flex h-12 items-center justify-center rounded-xl text-xl font-semibold"
            style={{ backgroundColor: 'var(--card)' }}
            onClick={() => setAmount(pressKey(amount, key))}
          >
            {key === 'back' ? <Delete size={22} /> : key}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {editing && (
          <button aria-label="Slet" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn btn-accent flex-1" disabled={!valid || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending ? 'Gemmer...' : 'Gem'}
        </button>
      </div>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Slet transaktion?"
        text={
          isTransfer
            ? 'Begge sider af overførslen slettes, og saldoen på begge konti rettes tilbage.'
            : 'Transaktionen slettes, og kontoens saldo rettes tilbage.'
        }
        confirmLabel="Slet"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}
