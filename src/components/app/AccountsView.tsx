'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, X, ArrowLeftRight, ChevronLeft } from 'lucide-react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { formatAmount, formatAmountShort, formatDate } from '@/lib/format';
import SelectField from './SelectField';

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl pt-3 px-6 pb-6 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 -12px 40px -12px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4 sm:hidden" style={{ backgroundColor: 'var(--border)' }} />
        {children}
      </div>
    </div>
  );
}

export default function AccountsView() {
  const { selectedAccountId, setSelectedAccountId } = useAppStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [transferDest, setTransferDest] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('custom');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [newAccountGoal, setNewAccountGoal] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.accounts.list();
      setAccounts(data.accounts);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadAccounts();
      setLoading(false);
    };
    init();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedAccountId) {
      loadTransactions();
    }
  }, [selectedAccountId]);

  const loadTransactions = async () => {
    if (!selectedAccountId) return;
    try {
      const data = await api.transactions.list(selectedAccountId);
      setTransactions(data.transactions);
    } catch (err) {
      console.error(err);
    }
  };

  const currentAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleAddMoney = async (isAdd: boolean) => {
    if (!selectedAccountId || !amount) return;
    setActionLoading(true);
    try {
      const val = parseFloat(amount.replace(',', '.'));
      if (isNaN(val)) return;
      await api.accounts.addBalance(selectedAccountId, isAdd ? val : -val, note || undefined);
      setAmount('');
      setNote('');
      setShowAddMoney(false);
      await loadAccounts();
      await loadTransactions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedAccountId || !transferDest || !transferAmount) return;
    setActionLoading(true);
    try {
      const val = parseFloat(transferAmount.replace(',', '.'));
      if (isNaN(val) || val <= 0) return;
      await api.accounts.transfer(selectedAccountId, transferDest, val, transferNote || undefined);
      setTransferAmount('');
      setTransferNote('');
      setTransferDest('');
      setShowTransfer(false);
      await loadAccounts();
      await loadTransactions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName) return;
    setActionLoading(true);
    try {
      const balance = parseFloat(newAccountBalance.replace(',', '.')) || 0;
      const targetAmount = newAccountType === 'goal_savings' && newAccountGoal
        ? parseFloat(newAccountGoal.replace(',', '.')) || 0
        : undefined;
      const acc = await api.accounts.create({
        name: newAccountName,
        type: newAccountType,
        balance,
        targetAmount,
      });
      setNewAccountName('');
      setNewAccountBalance('');
      setNewAccountGoal('');
      setShowCreateAccount(false);
      await loadAccounts();
      setSelectedAccountId(acc.account.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setActionLoading(true);
    try {
      await api.accounts.delete(id);
      if (selectedAccountId === id) setSelectedAccountId(null);
      await loadAccounts();
      setShowDeleteConfirm(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--fg-muted)' }}>
        <div className="animate-pulse text-lg">Indlæser...</div>
      </div>
    );
  }

  // Account detail view
  if (currentAccount) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-6 pb-4">
          <button
            onClick={() => { setSelectedAccountId(null); setTransactions([]); }}
            className="flex items-center gap-1 mb-4 text-sm -ml-1"
            style={{ color: 'var(--fg-muted)' }}
          >
            <ChevronLeft size={18} />
            Tilbage
          </button>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>{currentAccount.name}</h2>
          <p className="text-2xl font-bold mt-1" style={{ color: currentAccount.balance >= 0 ? 'var(--accent)' : '#ef4444' }}>
            {formatAmount(currentAccount.balance)}
          </p>
          {currentAccount.type === 'goal_savings' && currentAccount.goal && (
            <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
              Mål: {formatAmount(currentAccount.goal.targetAmount)}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowAddMoney(true)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Tilføj / Fjern
            </button>
            <button
              onClick={() => setShowTransfer(true)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(148,163,184,0.15)', color: 'var(--fg)' }}
            >
              <ArrowLeftRight size={15} />
              Overfør
            </button>
            <button
              onClick={() => setShowDeleteConfirm(currentAccount.id)}
              className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ overscrollBehavior: 'contain' }}>
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--fg-muted)' }}>
            Transaktioner
          </p>
          {transactions.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--fg-muted)' }}>
              Ingen transaktioner endnu
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
                      {tx.note || (tx.amount >= 0 ? 'Indbetaling' : 'Hævning')}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {formatDate(tx.createdAt)}
                      </p>
                      {tx.type === 'automatic' && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                          auto
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-bold shrink-0" style={{ color: tx.amount >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatAmountShort(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add money modal */}
        {showAddMoney && (
          <Modal onClose={() => setShowAddMoney(false)}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>Tilføj / Fjern penge</h3>
            <div className="space-y-3">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Beløb (f.eks. 250 eller -50)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
                autoFocus
              />
              <input
                type="text"
                placeholder="Note (valgfrit)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddMoney(true)}
                  disabled={actionLoading || !amount}
                  className="flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: '#10b981', color: '#fff' }}
                >
                  + Indsæt
                </button>
                <button
                  onClick={() => handleAddMoney(false)}
                  disabled={actionLoading || !amount}
                  className="flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                >
                  - Hæv
                </button>
              </div>
              <button
                onClick={() => { setAmount(''); setNote(''); setShowAddMoney(false); }}
                className="w-full py-2.5 rounded-xl text-sm"
                style={{ color: 'var(--fg-muted)' }}
              >
                Annuller
              </button>
            </div>
          </Modal>
        )}

        {/* Transfer modal */}
        {showTransfer && (
          <Modal onClose={() => setShowTransfer(false)}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>Overfør mellem konti</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--fg-muted)' }}>Fra: {currentAccount.name}</p>
              </div>
              <SelectField
                value={transferDest}
                onChange={(e) => setTransferDest(e.target.value)}
                style={inputStyle}
              >
                <option value="">Vælg modtagerkonto...</option>
                {accounts
                  .filter((a) => a.id !== selectedAccountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatAmount(a.balance)})
                    </option>
                  ))}
              </SelectField>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Beløb"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Note (valgfrit)"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
              />
              <button
                onClick={handleTransfer}
                disabled={actionLoading || !transferDest || !transferAmount}
                className="w-full py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Overfør
              </button>
              <button
                onClick={() => { setTransferAmount(''); setTransferNote(''); setTransferDest(''); setShowTransfer(false); }}
                className="w-full py-2.5 rounded-xl text-sm"
                style={{ color: 'var(--fg-muted)' }}
              >
                Annuller
              </button>
            </div>
          </Modal>
        )}

        {/* Delete confirm modal */}
        {showDeleteConfirm && (
          <Modal onClose={() => setShowDeleteConfirm(null)}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--fg)' }}>Slet konto?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>
              Dette sletter også alle transaktioner på kontoen. Handlingen kan ikke fortrydes.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteAccount(showDeleteConfirm)}
                disabled={actionLoading}
                className="flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
              >
                Slet
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                style={{ backgroundColor: 'rgba(148,163,184,0.15)', color: 'var(--fg)' }}
              >
                Annuller
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // Account list view
  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4" style={{ overscrollBehavior: 'contain' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>Konti</h2>
        <button
          onClick={() => setShowCreateAccount(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-[0.95] transition-transform"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="space-y-2.5">
        {accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => setSelectedAccountId(account.id)}
            className="w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all duration-150 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 2px 10px -6px rgba(0,0,0,0.3)' }}
          >
            <div>
              <p className="font-semibold text-base" style={{ color: 'var(--fg)' }}>{account.name}</p>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {account.type === 'goal_savings' ? 'Mål-konto' : account.type.charAt(0).toUpperCase() + account.type.slice(1)}
              </p>
            </div>
            <p className="font-bold text-base" style={{ color: account.balance >= 0 ? 'var(--fg)' : '#ef4444' }}>
              {formatAmount(account.balance)}
            </p>
          </button>
        ))}
      </div>

      {/* Create account modal */}
      {showCreateAccount && (
        <Modal onClose={() => setShowCreateAccount(false)}>
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>Opret ny konto</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Kontonavn"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base outline-none"
              style={inputStyle}
              autoFocus
            />
            <SelectField
              value={newAccountType}
              onChange={(e) => setNewAccountType(e.target.value)}
              style={inputStyle}
            >
              <option value="custom">Standard konto</option>
              <option value="opsparing">Opsparing</option>
              <option value="monizz">Monizz</option>
              <option value="donation">Donation</option>
              <option value="goal_savings">Min egen opsparing (mål)</option>
            </SelectField>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Startsaldo (valgfrit)"
              value={newAccountBalance}
              onChange={(e) => setNewAccountBalance(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base outline-none"
              style={inputStyle}
            />
            {newAccountType === 'goal_savings' && (
              <input
                type="text"
                inputMode="decimal"
                placeholder="Målbeløb"
                value={newAccountGoal}
                onChange={(e) => setNewAccountGoal(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
              />
            )}
            <button
              onClick={handleCreateAccount}
              disabled={actionLoading || !newAccountName}
              className="w-full py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Opret konto
            </button>
            <button
              onClick={() => setShowCreateAccount(false)}
              className="w-full py-2.5 rounded-xl text-sm"
              style={{ color: 'var(--fg-muted)' }}
            >
              Annuller
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
