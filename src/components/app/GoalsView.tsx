'use client';

import { useEffect, useState } from 'react';
import { Target, ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAmount } from '@/lib/format';

export default function GoalsView() {
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [animatingGoals, setAnimatingGoals] = useState<Record<string, number>>({});
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        const data = await api.accounts.list();
        if (!cancelled) {
          setAllAccounts(data.accounts);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setAllAccounts([]);
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const goalAccounts = allAccounts.filter(
    (a) => a.type === 'goal_savings' && a.goal
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const anims: Record<string, number> = {};
      goalAccounts.forEach((a) => {
        if (a.goal) {
          anims[a.id] = Math.min((a.balance / a.goal.targetAmount) * 100, 100);
        }
      });
      setAnimatingGoals(anims);
    }, 100);
    return () => clearTimeout(timer);
  }, [goalAccounts]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--fg-muted)' }}>
        <div className="animate-pulse text-lg">Indlæser...</div>
      </div>
    );
  }

  if (goalAccounts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <Target size={56} className="mb-4 opacity-30" style={{ color: 'var(--fg)' }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Ingen mål endnu</h2>
        <p className="text-sm text-center" style={{ color: 'var(--fg-muted)' }}>
          Opret en "Min egen opsparing"-konto under Konti for at starte et sparemål.
        </p>
      </div>
    );
  }

  const selectedGoal = selectedGoalId ? goalAccounts.find((a) => a.id === selectedGoalId) : null;

  if (selectedGoal) {
    const animatedPct = animatingGoals[selectedGoal.id] || 0;
    return (
      <div className="relative flex-1 overflow-hidden">
        <div className="relative z-10 px-4 pt-6 pb-2 flex flex-col items-center gap-1">
          <button
            onClick={() => setSelectedGoalId(null)}
            className="self-start flex items-center gap-1 text-sm mb-2.5"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            <ChevronLeft size={18} />
            Tilbage
          </button>
          <p className="text-base font-semibold text-center w-full" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {selectedGoal.name}
          </p>
          <h2 className="text-3xl font-bold text-center w-full text-white">
            {formatAmount(selectedGoal.balance)}
          </h2>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Mål: {formatAmount(selectedGoal.goal.targetAmount)}
          </p>
        </div>

        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
            style={{
              height: `${animatedPct}%`,
              background: `linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))`,
            }}
          >
            <div
              className="absolute top-0 left-0 right-0"
              style={{
                height: '4px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
              }}
            />
          </div>
        </div>

        <div className="relative z-10 h-full flex items-center justify-center">
          <span className="text-6xl font-bold text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
            {Math.round(animatedPct)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4" style={{ overscrollBehavior: 'contain' }}>
      <h2 className="text-2xl font-bold mb-6 tracking-tight text-center" style={{ color: 'var(--fg)' }}>Mit mål</h2>

      <div className="space-y-8">
        {goalAccounts.map((account) => {
          const animatedPct = animatingGoals[account.id] || 0;

          return (
            <button
              key={account.id}
              onClick={() => setSelectedGoalId(account.id)}
              className="w-full flex flex-col items-center active:scale-[0.98] transition-transform"
            >
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--fg-muted)' }}>
                {account.name}
              </p>
              <p className="text-3xl font-bold mb-4" style={{ color: 'var(--fg)' }}>
                {formatAmount(account.balance)}
              </p>

              {/* Glass fill animation */}
              <div
                className="relative w-48 h-56 rounded-3xl overflow-hidden"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 8px 30px -10px rgba(0,0,0,0.4)',
                }}
              >
                {/* Glass body */}
                <div
                  className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
                  style={{
                    height: `${animatedPct}%`,
                    background: `linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))`,
                    borderRadius: animatedPct > 95 ? '0 0 20px 20px' : '0 0 0 0',
                  }}
                />
                {/* Water surface shimmer */}
                {animatedPct > 2 && (
                  <div
                    className="absolute left-0 right-0 transition-all duration-1000 ease-out"
                    style={{
                      bottom: `${animatedPct}%`,
                      height: '3px',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    }}
                  />
                )}
                {/* Percentage in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-2xl font-bold"
                    style={{
                      color: animatedPct > 50 ? 'rgba(255,255,255,0.9)' : 'var(--fg)',
                      textShadow: animatedPct > 50 ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    {Math.round(animatedPct)}%
                  </span>
                </div>
              </div>

              <p className="text-xs mt-3" style={{ color: 'var(--fg-muted)' }}>
                Mål: {formatAmount(account.goal.targetAmount)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}