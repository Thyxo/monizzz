'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight, ChevronLeft, ImagePlus, Pencil, Plus, PlusCircle, Trash2, Wallet } from 'lucide-react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { useAccounts, useAction, useOnline, useTransactions } from '@/lib/queries';
import { ACCOUNT_TYPE_LABELS, formatAmount, parseAmount } from '@/lib/format';
import {
  AccountBadge,
  ConfirmSheet,
  Empty,
  Header,
  IconButton,
  Sheet,
  SkeletonList,
  TransactionRow,
} from '@/components/app/ui';

const PAGE = 50;

export default function AccountsView() {
  const { selectedAccountId, setSelectedAccountId } = useAppStore();
  const { accounts, isPending } = useAccounts();
  const account = accounts.find((a) => a.id === selectedAccountId);

  if (account) return <AccountDetail key={account.id} account={account} accounts={accounts} onBack={() => setSelectedAccountId(null)} />;
  return <AccountList accounts={accounts} loading={isPending} onOpen={setSelectedAccountId} />;
}

function GoalBar({ account }: { account: any }) {
  if (!account.goal) return null;
  const pct = Math.max(0, Math.min((account.balance / account.goal.targetAmount) * 100, 100));
  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }} />
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
        {Math.round(pct)}% af {formatAmount(account.goal.targetAmount)}
      </p>
    </div>
  );
}

function AccountList({ accounts, loading, onOpen }: { accounts: any[]; loading: boolean; onOpen: (id: string) => void }) {
  const online = useOnline();
  const openImport = useAppStore((state) => state.openImport);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('custom');
  const [balance, setBalance] = useState('');
  const [goal, setGoal] = useState('');

  const create = useAction(
    () =>
      api.accounts.create({
        name: name.trim(),
        type,
        balance: parseAmount(balance) || 0,
        targetAmount: type === 'goal_savings' ? parseAmount(goal) || undefined : undefined,
      }),
    {
      success: 'Konto oprettet',
      onDone: (result) => {
        setCreating(false);
        setName('');
        setBalance('');
        setGoal('');
        onOpen(result.account.id);
      },
    },
  );

  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const validGoal = type !== 'goal_savings' || parseAmount(goal) > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Konti"
        right={
          <>
            <IconButton icon={ImagePlus} label="Importér fra screenshot" disabled={!online || accounts.length === 0} onClick={() => openImport({})} />
            <IconButton icon={Plus} label="Ny konto" accent disabled={!online} onClick={() => setCreating(true)} />
          </>
        }
      />
      <div className="scroll-area px-4 pb-6">
        {loading ? (
          <SkeletonList rows={4} />
        ) : accounts.length === 0 ? (
          <Empty
            icon={Wallet}
            title="Ingen konti endnu"
            text="Opret en konto for at komme i gang med at holde styr på dine penge."
            action={<button className="btn btn-accent" onClick={() => setCreating(true)}>Opret konto</button>}
          />
        ) : (
          <>
            <p className="mb-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
              I alt <strong style={{ color: 'var(--fg)' }}>{formatAmount(total)}</strong>
            </p>
            <div className="space-y-2">
              {accounts.map((account) => (
                <button key={account.id} onClick={() => onOpen(account.id)} className="card pressable w-full p-4 text-left">
                  <div className="flex items-center gap-3">
                    <AccountBadge type={account.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{account.name}</p>
                      <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold" style={{ color: account.balance < 0 ? 'var(--expense)' : 'var(--fg)' }}>
                      {formatAmount(account.balance)}
                    </p>
                  </div>
                  <GoalBar account={account} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Opret ny konto">
        <div className="space-y-3">
          <input className="field" placeholder="Kontonavn" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="custom">Standard konto</option>
            <option value="opsparing">Opsparing</option>
            <option value="monizz">Monizz</option>
            <option value="donation">Donation</option>
            <option value="goal_savings">Min egen opsparing (mål)</option>
          </select>
          <input
            className="field"
            inputMode="decimal"
            placeholder="Startsaldo (valgfrit)"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
          {type === 'goal_savings' && (
            <input className="field" inputMode="decimal" placeholder="Målbeløb" value={goal} onChange={(e) => setGoal(e.target.value)} />
          )}
          <button
            className="btn btn-accent w-full"
            disabled={!name.trim() || !validGoal || create.isPending}
            onClick={() => create.mutate(undefined)}
          >
            Opret konto
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function AccountDetail({ account, accounts, onBack }: { account: any; accounts: any[]; onBack: () => void }) {
  const openSheet = useAppStore((state) => state.openSheet);
  const openImport = useAppStore((state) => state.openImport);
  const online = useOnline();
  const [limit, setLimit] = useState(PAGE);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(account.name);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goal, setGoal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { transactions, total, isPending } = useTransactions({ accountId: account.id, limit });
  // Selection mode: tapping rows ticks them, and the bar at the bottom deletes or moves them.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setMoving(false);
    setConfirmBulkDelete(false);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allSelected = transactions.length > 0 && transactions.every((tx) => selected.has(tx.id));
  const bulkDelete = useAction(() => api.transactions.bulk({ action: 'delete', ids: [...selected] }), {
    onDone: (result) => {
      toast.success(result.changed === 1 ? '1 transaktion slettet' : `${result.changed} transaktioner slettet`);
      stopSelecting();
    },
  });
  const bulkMove = useAction(
    (accountId: string) => api.transactions.bulk({ action: 'move', ids: [...selected], accountId }),
    {
      onDone: (result) => {
        toast.success(result.changed === 1 ? '1 transaktion flyttet' : `${result.changed} transaktioner flyttet`);
        stopSelecting();
      },
    },
  );

  const rename = useAction(() => api.accounts.rename(account.id, name.trim()), {
    success: 'Navn ændret',
    onDone: () => setRenaming(false),
  });
  const saveGoal = useAction(() => api.goals.update(account.id, parseAmount(goal)), {
    success: 'Mål gemt',
    onDone: () => setEditingGoal(false),
  });
  const remove = useAction(() => api.accounts.delete(account.id), { success: 'Konto slettet', onDone: onBack });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title={account.name}
        left={
          <button aria-label="Tilbage" className="pressable -ml-2 p-1" onClick={onBack}>
            <ChevronLeft size={26} />
          </button>
        }
        right={
          <>
            <IconButton icon={ImagePlus} label="Importér fra screenshot" disabled={!online} onClick={() => openImport({ accountId: account.id })} />
            <IconButton icon={Pencil} label="Omdøb" disabled={!online} onClick={() => { setName(account.name); setRenaming(true); }} />
            <IconButton icon={Trash2} label="Slet konto" disabled={!online} onClick={() => setConfirmDelete(true)} />
          </>
        }
      />

      <div className="shrink-0 px-4 pb-4">
        <p className="text-3xl font-bold" style={{ color: account.balance < 0 ? 'var(--expense)' : 'var(--accent)' }}>
          {formatAmount(account.balance)}
        </p>
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{ACCOUNT_TYPE_LABELS[account.type] || account.type}</p>
        {account.type === 'goal_savings' && (
          <button
            className="mt-1 block w-full text-left"
            disabled={!online}
            style={{ opacity: 1 }}
            onClick={() => { setGoal(account.goal ? String(account.goal.targetAmount).replace('.', ',') : ''); setEditingGoal(true); }}
          >
            {account.goal ? <GoalBar account={account} /> : null}
            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              {account.goal ? 'Ret mål' : 'Sæt et mål'}
            </span>
          </button>
        )}

        <div className="mt-4 flex gap-2">
          <button className="btn btn-accent flex-1" disabled={!online} onClick={() => openSheet({ kind: 'income', accountId: account.id })}>
            <PlusCircle size={18} /> Tilføj / Fjern
          </button>
          <button
            className="btn btn-soft flex-1"
            disabled={!online || accounts.length < 2}
            onClick={() => openSheet({ kind: 'transfer', accountId: account.id })}
          >
            <ArrowLeftRight size={18} /> Overfør
          </button>
        </div>
      </div>

      <div className="scroll-area px-4 pb-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="label">{selecting ? `${selected.size} valgt` : 'Transaktioner'}</p>
          {transactions.length > 0 && (
            <div className="flex items-center gap-4">
              {selecting && (
                <button
                  className="text-xs font-semibold"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => setSelected(allSelected ? new Set() : new Set(transactions.map((tx) => tx.id)))}
                >
                  {allSelected ? 'Fravælg alle' : 'Vælg alle'}
                </button>
              )}
              <button
                className="text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
                disabled={!online}
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              >
                {selecting ? 'Annullér' : 'Vælg'}
              </button>
            </div>
          )}
        </div>
        {isPending ? (
          <SkeletonList rows={4} />
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>Ingen transaktioner endnu</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                showAccount={false}
                selected={selecting ? selected.has(tx.id) : undefined}
                onClick={() => (selecting ? toggle(tx.id) : openSheet({ transaction: tx }))}
              />
            ))}
            {transactions.length < total && (
              <button className="btn btn-soft w-full" onClick={() => setLimit(limit + PAGE)}>
                Vis flere ({total - transactions.length})
              </button>
            )}
          </div>
        )}
      </div>

      {selecting && (
        <div
          className="flex shrink-0 gap-2 border-t px-4 pt-3"
          style={{ borderColor: 'var(--border)', paddingBottom: '0.75rem' }}
        >
          <button
            className="btn btn-soft flex-1"
            disabled={selected.size === 0 || !online || accounts.length < 2}
            onClick={() => setMoving(true)}
          >
            <ArrowLeftRight size={16} /> Flyt
          </button>
          <button className="btn btn-danger flex-1" disabled={selected.size === 0 || !online} onClick={() => setConfirmBulkDelete(true)}>
            <Trash2 size={16} /> Slet
          </button>
        </div>
      )}

      <Sheet open={moving} onClose={() => setMoving(false)} title={`Flyt ${selected.size} til`}>
        <div className="space-y-2">
          {accounts
            .filter((a) => a.id !== account.id)
            .map((a) => (
              <button
                key={a.id}
                className="card pressable flex w-full items-center gap-3 p-3 text-left"
                disabled={bulkMove.isPending}
                onClick={() => bulkMove.mutate(a.id)}
              >
                <AccountBadge type={a.type} size={36} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.name}</span>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>{formatAmount(a.balance)}</span>
              </button>
            ))}
          <p className="pt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
            Saldoen rettes på begge konti. Ved en overførsel flyttes kun denne kontos side.
          </p>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title={selected.size === 1 ? 'Slet 1 transaktion?' : `Slet ${selected.size} transaktioner?`}
        text="Saldoen rettes tilsvarende. Er der overførsler imellem, slettes begge sider. Handlingen kan ikke fortrydes."
        confirmLabel="Slet"
        busy={bulkDelete.isPending}
        onConfirm={() => bulkDelete.mutate(undefined)}
      />

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Omdøb konto">
        <div className="space-y-3">
          <input className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-accent w-full" disabled={!name.trim() || rename.isPending} onClick={() => rename.mutate(undefined)}>
            Gem
          </button>
        </div>
      </Sheet>

      <Sheet open={editingGoal} onClose={() => setEditingGoal(false)} title="Sparemål">
        <div className="space-y-3">
          <input className="field" inputMode="decimal" placeholder="Målbeløb" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <button
            className="btn btn-accent w-full"
            disabled={!(parseAmount(goal) > 0) || saveGoal.isPending}
            onClick={() => saveGoal.mutate(undefined)}
          >
            Gem mål
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Slet konto?"
        text={`"${account.name}" og alle kontoens transaktioner slettes. Handlingen kan ikke fortrydes.`}
        confirmLabel="Slet konto"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}
