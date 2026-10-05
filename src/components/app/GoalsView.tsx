'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { useAppStore } from '@/store';
import { useAccounts, useOnline } from '@/lib/queries';
import { formatAmount } from '@/lib/format';
import { Empty, Header, SkeletonList } from '@/components/app/ui';

export default function GoalsView() {
  const { openSheet, openAccount, setActiveTab } = useAppStore();
  const { accounts, isPending } = useAccounts();
  const online = useOnline();
  const goalAccounts = accounts.filter((account) => account.type === 'goal_savings' && account.goal);

  // Start empty and fill shortly after mount so the glass animates up.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilled(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title="Mål" />
      <div className="scroll-area px-4 pb-6">
        {isPending ? (
          <SkeletonList rows={2} />
        ) : goalAccounts.length === 0 ? (
          <Empty
            icon={Target}
            title="Ingen mål endnu"
            text='Opret en "Min egen opsparing"-konto under Konti for at starte et sparemål.'
            action={<button className="btn btn-accent" onClick={() => setActiveTab('accounts')}>Gå til Konti</button>}
          />
        ) : (
          <div className="space-y-10 pt-2">
            {goalAccounts.map((account) => {
              const pct = Math.max(0, Math.min((account.balance / account.goal.targetAmount) * 100, 100));
              const shown = filled ? pct : 0;
              const left = account.goal.targetAmount - account.balance;
              return (
                <div key={account.id} className="flex flex-col items-center">
                  <p className="mb-1 text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>{account.name}</p>
                  <p className="mb-4 text-3xl font-bold">{formatAmount(account.balance)}</p>

                  <button
                    aria-label={`Åbn ${account.name}`}
                    onClick={() => openAccount(account.id)}
                    className="relative h-56 w-48 overflow-hidden rounded-3xl"
                    style={{ backgroundColor: 'var(--card)', border: '2px solid var(--border)' }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
                      style={{
                        height: `${shown}%`,
                        background: 'linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))',
                      }}
                    />
                    {shown > 2 && (
                      <div
                        className="absolute left-0 right-0 transition-all duration-1000 ease-out"
                        style={{
                          bottom: `${shown}%`,
                          height: '3px',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                        }}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="text-2xl font-bold"
                        style={{
                          color: shown > 50 ? 'rgba(255,255,255,0.95)' : 'var(--fg)',
                          textShadow: shown > 50 ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                        }}
                      >
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </button>

                  <p className="mt-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
                    Mål: {formatAmount(account.goal.targetAmount)}
                    {left > 0 ? ` · mangler ${formatAmount(left)}` : ' · nået!'}
                  </p>
                  <button
                    className="btn btn-soft mt-3"
                    disabled={!online}
                    onClick={() => openSheet({ kind: 'income', accountId: account.id })}
                  >
                    Indsæt på målet
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
