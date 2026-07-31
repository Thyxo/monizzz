'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { formatAmount } from '@/lib/format';

export default function OverviewView() {
  const { user, setActiveTab, setSelectedAccountId } = useAppStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.accounts.list();
      setAccounts(data.accounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const getIconBg = (type: string) => {
    switch (type) {
      case 'opsparing': return 'rgba(16, 185, 129, 0.15)';
      case 'monizz': return 'rgba(251, 191, 36, 0.15)';
      case 'donation': return 'rgba(239, 68, 68, 0.15)';
      case 'goal_savings': return 'rgba(168, 85, 247, 0.15)';
      default: return 'rgba(148, 163, 184, 0.15)';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'opsparing': return '#10b981';
      case 'monizz': return '#fbbf24';
      case 'donation': return '#ef4444';
      case 'goal_savings': return '#a855f7';
      default: return '#94a3b8';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'opsparing': return '\u2191';
      case 'monizz': return '\u26AB';
      case 'donation': return '\u2764';
      case 'goal_savings': return '\u2605';
      default: return '\u25CF';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--fg-muted)' }}>
        <div className="animate-pulse text-lg">Indlæser...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4" style={{ overscrollBehavior: 'contain' }}>
      <div className="mb-6">
        <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
          Hej, {user?.username}
        </p>
        <h2 className="text-2xl font-bold mt-1" style={{ color: 'var(--fg)' }}>
          {formatAmount(totalBalance)}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>Samlet balance</p>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => { setSelectedAccountId(account.id); setActiveTab('accounts'); }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
              style={{ backgroundColor: getIconBg(account.type), color: getIconColor(account.type) }}
            >
              {getIcon(account.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--fg)' }}>
                {account.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {account.type === 'goal_savings' && account.goal
                  ? `Mål: ${formatAmount(account.goal.targetAmount)}`
                  : account.type === 'opsparing' ? 'Opsparing'
                  : account.type === 'donation' ? 'Donation'
                  : account.type === 'monizz' ? 'Lommepenge'
                  : 'Konto'}
              </p>
            </div>
            <p className="font-bold text-sm" style={{ color: account.balance >= 0 ? 'var(--fg)' : '#ef4444' }}>
              {formatAmount(account.balance)}
            </p>
          </button>
        ))}

        {accounts.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--fg-muted)' }}>
            <p className="text-lg mb-2">Ingen konti endnu</p>
            <p className="text-sm">Opret din første konto i Indstillinger</p>
          </div>
        )}
      </div>
    </div>
  );
}
