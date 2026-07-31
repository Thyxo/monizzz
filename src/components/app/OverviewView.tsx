'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Coins, Heart, Target, Wallet } from 'lucide-react';
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
      case 'opsparing': return TrendingUp;
      case 'monizz': return Coins;
      case 'donation': return Heart;
      case 'goal_savings': return Target;
      default: return Wallet;
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
      <div
        className="mb-6 p-5 rounded-3xl"
        style={{
          background: `linear-gradient(135deg, rgba(var(--accent-rgb), 0.16), rgba(var(--accent-rgb), 0.03))`,
          border: '1px solid var(--border)',
        }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
          Hej, {user?.username}
        </p>
        <h2 className="text-3xl font-bold mt-1 tracking-tight" style={{ color: 'var(--fg)' }}>
          {formatAmount(totalBalance)}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>Samlet balance</p>
      </div>

      <div className="space-y-2.5">
        {accounts.map((account) => {
          const Icon = getIcon(account.type);
          return (
            <button
              key={account.id}
              onClick={() => { setSelectedAccountId(account.id); setActiveTab('accounts'); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 10px -6px rgba(0,0,0,0.3)',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: getIconBg(account.type), color: getIconColor(account.type) }}
              >
                <Icon size={20} strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate" style={{ color: 'var(--fg)' }}>
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
              <p className="font-bold text-base" style={{ color: account.balance >= 0 ? 'var(--fg)' : '#ef4444' }}>
                {formatAmount(account.balance)}
              </p>
            </button>
          );
        })}

        {accounts.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--fg-muted)' }}>
            <Wallet size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-lg mb-2" style={{ color: 'var(--fg)' }}>Ingen konti endnu</p>
            <p className="text-sm">Opret din første konto i Indstillinger</p>
          </div>
        )}
      </div>
    </div>
  );
}
