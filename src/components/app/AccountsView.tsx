'use client';

import { useState } from 'react';
import { ArrowLeftRight, ChevronLeft, Pencil, Plus, PlusCircle, Trash2, Wallet } from 'lucide-react';
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

  if (account) return <AccountDetail account={account} accounts={accounts} onBack={() => setSelectedAccountId(null)} />;
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
        right={<IconButton icon={Plus} label="Ny konto" accent disabled={!online} onClick={() => setCreating(true)} />}
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
  const online = useOnline();
  const [limit, setLimit] = useState(PAGE);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(account.name);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goal, setGoal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { transactions, total, isPending } = useTransactions({ accountId: account.id, limit });

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
        <p className="label mb-2">Transaktioner</p>
        {isPending ? (
          <SkeletonList rows={4} />
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>Ingen transaktioner endnu</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showAccount={false} onClick={() => openSheet({ transaction: tx })} />
            ))}
            {transactions.length < total && (
              <button className="btn btn-soft w-full" onClick={() => setLimit(limit + PAGE)}>
                Vis flere ({total - transactions.length})
              </button>
            )}
          </div>
        )}
      </div>

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
