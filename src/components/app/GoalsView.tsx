'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, Target } from 'lucide-react';
import { useAppStore } from '@/store';
import { useAccounts, useOnline } from '@/lib/queries';
import { formatAmount } from '@/lib/format';
import { Empty, Header, SkeletonList } from '@/components/app/ui';

const percent = (account: any) => Math.max(0, Math.min((account.balance / account.goal.targetAmount) * 100, 100));

export default function GoalsView() {
  const { openSheet, setActiveTab } = useAppStore();
  const { accounts, isPending } = useAccounts();
  const online = useOnline();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const goalAccounts = accounts.filter((account) => account.type === 'goal_savings' && account.goal);
  const selectedGoal = goalAccounts.find((account) => account.id === selectedGoalId);

  // Start empty and fill shortly after a view opens, so the water animates up.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilled(true), 100);
    return () => clearTimeout(timer);
  }, [selectedGoalId]);
  const open = (id: string | null) => {
    setFilled(false);
    setSelectedGoalId(id);
  };

  // One goal across the whole screen.
  if (selectedGoal) {
    const pct = percent(selectedGoal);
    const shown = filled ? pct : 0;
    // The header sits at the top, so it is only on top of the fill when the goal is nearly reached.
    const headerColor = shown > 82 ? '#ffffff' : 'var(--fg)';
    return (
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--card)' }}>
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
            style={{
              height: `${shown}%`,
              background: 'linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))',
            }}
          >
            <div
              className="absolute left-0 right-0 top-0"
              style={{ height: '4px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
            />
          </div>
        </div>

        <div
          className="relative z-10 flex flex-col items-center gap-1 px-4 pb-2 transition-colors duration-1000"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)', color: headerColor }}
        >
          <button onClick={() => open(null)} className="pressable mb-2.5 flex items-center gap-1 self-start text-sm">
            <ChevronLeft size={18} />
            Tilbage
          </button>
          <p className="w-full text-center text-base font-semibold">{selectedGoal.name}</p>
          <h2 className="w-full text-center text-3xl font-bold">{formatAmount(selectedGoal.balance)}</h2>
          <p className="text-xs opacity-70">Mål: {formatAmount(selectedGoal.goal.targetAmount)}</p>
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span
            className="text-6xl font-bold transition-colors duration-1000"
            style={{
              color: shown > 50 ? '#ffffff' : 'var(--fg)',
              textShadow: shown > 50 ? '0 2px 10px rgba(0,0,0,0.35)' : 'none',
            }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>
    );
  }

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
              const pct = percent(account);
              const shown = filled ? pct : 0;
              const left = account.goal.targetAmount - account.balance;
              return (
                <div key={account.id} className="flex flex-col items-center">
                  <p className="mb-1 text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>{account.name}</p>
                  <p className="mb-4 text-3xl font-bold">{formatAmount(account.balance)}</p>

                  <button
                    aria-label={`Vis ${account.name} i fuld skærm`}
                    onClick={() => open(account.id)}
                    className="pressable relative h-56 w-48 overflow-hidden rounded-3xl"
                    style={{
                      backgroundColor: 'var(--card)',
                      border: '2px solid var(--border)',
                      boxShadow: '0 8px 30px -10px rgba(0,0,0,0.4)',
                    }}
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
