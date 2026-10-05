'use client';

import { useState } from 'react';
import { ArrowRight, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type RuleInput } from '@/lib/api';
import { useAccounts, useAction, useCategories, useOnline, useRules } from '@/lib/queries';
import { formatAmount, formatUpcoming, fromYmd, intervalText, parseAmount, scheduleText, toDateInput } from '@/lib/format';
import { ConfirmSheet, Empty, Header, IconButton, Segmented, Sheet, SkeletonList } from '@/components/app/ui';

type RuleDraft = {
  id?: string;
  name: string;
  amount: string;
  frequency: RuleInput['frequency'];
  interval: string;
  nextDate: string; // yyyy-MM-dd
  sourceAccountId: string;
  destAccountId: string;
  categoryId: string;
};

const newRule = (): RuleDraft => ({
  name: '',
  amount: '',
  frequency: 'monthly',
  interval: '1',
  nextDate: toDateInput(new Date()),
  sourceAccountId: '',
  destAccountId: '',
  categoryId: '',
});

const FREQUENCIES: { value: RuleInput['frequency']; label: string }[] = [
  { value: 'daily', label: 'Dag' },
  { value: 'weekly', label: 'Uge' },
  { value: 'monthly', label: 'Måned' },
];

// The intervals offered for a frequency, plus the rule's own if it is outside that range.
function intervalChoices(frequency: string, current: number): number[] {
  const choices = Array.from({ length: frequency === 'daily' ? 30 : 12 }, (_, i) => i + 1);
  return choices.includes(current) ? choices : [...choices, current];
}

// "Bogføres i morgen og derefter hver uge om fredagen."
function draftSummary(draft: RuleDraft): string {
  const repeat = scheduleText({
    frequency: draft.frequency,
    interval: parseInt(draft.interval) || 1,
    dayOfMonth: fromYmd(draft.nextDate).getDate(),
    nextDate: draft.nextDate,
  });
  return `Bogføres ${formatUpcoming(draft.nextDate)} og derefter ${repeat.charAt(0).toLowerCase()}${repeat.slice(1)}.`;
}

export default function RulesView() {
  const online = useOnline();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { rules, isPending } = useRules();

  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const closeRule = () => {
    setDraft(null);
    setConfirmDelete(false);
  };
  const saveRule = useAction(
    async (d: RuleDraft) => {
      const data: RuleInput = {
        name: d.name.trim(),
        amount: parseAmount(d.amount),
        frequency: d.frequency,
        interval: parseInt(d.interval) || 1,
        nextDate: d.nextDate,
        sourceAccountId: d.sourceAccountId || null,
        destAccountId: d.destAccountId || null,
        // A category only makes sense when money enters or leaves the system.
        categoryId: d.sourceAccountId && d.destAccountId ? null : d.categoryId || null,
      };
      await (d.id ? api.autoRules.update({ id: d.id, ...data }) : api.autoRules.create(data));
      // A rule that is due today books straight away instead of at the next app start.
      const run = await api.autoRules.run().catch(() => null);
      return run ? run.results.filter((result) => result.status !== 'error').length : 0;
    },
    {
      onDone: (booked) => {
        closeRule();
        if (booked === 0) toast.success('Regel gemt');
        else toast.success(booked === 1 ? 'Regel gemt – 1 postering bogført' : `Regel gemt – ${booked} posteringer bogført`);
      },
    },
  );
  const deleteRule = useAction((id: string) => api.autoRules.delete(id), { success: 'Regel slettet', onDone: closeRule });
  const runRules = useAction(() => api.autoRules.run(), {
    onDone: ({ results }) => {
      const booked = results.filter((result) => result.status !== 'error').length;
      const failed = results.length - booked;
      if (failed > 0) toast.error(`${failed} regel(er) kunne ikke bogføres`);
      else if (booked > 0) toast.success(booked === 1 ? '1 postering bogført' : `${booked} posteringer bogført`);
      else toast.info('Ingen regler er forfaldne lige nu');
    },
  });

  const ruleValid =
    draft &&
    draft.name.trim() &&
    parseAmount(draft.amount) > 0 &&
    draft.nextDate &&
    (draft.sourceAccountId || draft.destAccountId) &&
    draft.sourceAccountId !== draft.destAccountId;
  const draftKind = draft?.sourceAccountId && draft.destAccountId ? null : draft?.destAccountId ? 'income' : 'expense';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Automatiske regler"
        right={<IconButton icon={Plus} label="Ny regel" accent disabled={!online} onClick={() => setDraft(newRule())} />}
      />
      <div className="scroll-area px-4 pb-6">
        <p className="mb-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
          Regler bogføres automatisk, fx hver uge, hver anden dag eller hver måned. Har appen ikke været åben, indhentes de næste gang, du åbner den.
        </p>

        {isPending ? (
          <SkeletonList rows={3} />
        ) : rules.length === 0 ? (
          <Empty icon={Repeat} title="Ingen regler endnu" text="Tryk + for at oprette en, fx løn hver måned eller opsparing hver uge." />
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const inactive = !rule.sourceAccountId && !rule.destAccountId;
              return (
                <button
                  key={rule.id}
                  disabled={!online}
                  style={{ opacity: 1 }}
                  onClick={() =>
                    setDraft({
                      id: rule.id,
                      name: rule.name,
                      amount: String(rule.amount).replace('.', ','),
                      // The fallbacks cover a backend that has not been updated yet.
                      frequency: rule.frequency || 'monthly',
                      interval: String(rule.interval || 1),
                      nextDate: rule.nextDate || toDateInput(new Date()),
                      sourceAccountId: rule.sourceAccountId || '',
                      destAccountId: rule.destAccountId || '',
                      categoryId: rule.categoryId || '',
                    })
                  }
                  className="card pressable w-full p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{rule.name}</p>
                    <p className="shrink-0 text-sm font-bold">{formatAmount(rule.amount)}</p>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs" style={{ color: 'var(--fg-muted)' }}>
                    {rule.source?.name || 'Udefra'} <ArrowRight size={12} className="shrink-0" /> {rule.dest?.name || 'Ud af systemet'}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: inactive ? 'var(--expense)' : 'var(--fg-muted)' }}>
                    {inactive
                      ? 'Inaktiv – vælg en konto'
                      : rule.nextDate
                        ? `${scheduleText(rule)} · næste ${formatUpcoming(rule.nextDate)}`
                        : `D. ${rule.dayOfMonth}. hver måned`}
                  </p>
                </button>
              );
            })}
            <button className="btn btn-soft w-full" disabled={!online || runRules.isPending} onClick={() => runRules.mutate(undefined)}>
              <Play size={16} /> {runRules.isPending ? 'Kører...' : 'Kør forfaldne regler nu'}
            </button>
          </div>
        )}
      </div>

      <Sheet open={Boolean(draft)} onClose={closeRule} title={draft?.id ? 'Rediger regel' : 'Ny automatisk regel'}>
        {draft && (
          <div className="space-y-3">
            <input
              className="field"
              placeholder="Navn (f.eks. Opsparing)"
              maxLength={60}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <div>
              <p className="label mb-1.5">Beløb</p>
              <input
                className="field"
                inputMode="decimal"
                placeholder="250"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
            </div>
            <div>
              <p className="label mb-1.5">Hvor ofte</p>
              <Segmented
                value={draft.frequency}
                onChange={(frequency) => setDraft({ ...draft, frequency, interval: '1' })}
                options={FREQUENCIES}
              />
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <p className="label mb-1.5">Interval</p>
                <select className="field" value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value })}>
                  {intervalChoices(draft.frequency, parseInt(draft.interval) || 1).map((n) => (
                    <option key={n} value={n}>{intervalText(draft.frequency, n)}</option>
                  ))}
                </select>
              </div>
              <div className="w-40 shrink-0">
                <p className="label mb-1.5">{draft.id ? 'Næste gang' : 'Første gang'}</p>
                <input
                  type="date"
                  className="field"
                  min={toDateInput(new Date())}
                  value={draft.nextDate}
                  onChange={(e) => e.target.value && setDraft({ ...draft, nextDate: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              {draftSummary(draft)}
              {draft.frequency === 'monthly' && fromYmd(draft.nextDate).getDate() > 28 &&
                ' I måneder med færre dage bogføres den på månedens sidste dag.'}
            </p>
            <div>
              <p className="label mb-1.5">Fra</p>
              <select className="field" value={draft.sourceAccountId} onChange={(e) => setDraft({ ...draft, sourceAccountId: e.target.value })}>
                <option value="">Udefra (fx løn eller lommepenge)</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="label mb-1.5">Til</p>
              <select className="field" value={draft.destAccountId} onChange={(e) => setDraft({ ...draft, destAccountId: e.target.value })}>
                <option value="">Ud af systemet (fx donation)</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
            {draftKind && (
              <div>
                <p className="label mb-1.5">Kategori</p>
                <select className="field" value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
                  <option value="">Ingen kategori</option>
                  {categories
                    .filter((category) => category.kind === draftKind)
                    .map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                </select>
              </div>
            )}
            {!draft.sourceAccountId && !draft.destAccountId && (
              <p className="text-xs" style={{ color: 'var(--expense)' }}>Vælg mindst én konto.</p>
            )}
            <div className="flex gap-2 pt-1">
              {draft.id && (
                <button aria-label="Slet regel" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={18} />
                </button>
              )}
              <button className="btn btn-accent flex-1" disabled={!ruleValid || saveRule.isPending} onClick={() => saveRule.mutate(draft)}>
                Gem
              </button>
            </div>
            <ConfirmSheet
              open={confirmDelete}
              onClose={() => setConfirmDelete(false)}
              title="Slet regel?"
              text="Reglen stopper. Tidligere bogførte posteringer bliver stående."
              confirmLabel="Slet"
              busy={deleteRule.isPending}
              onConfirm={() => draft.id && deleteRule.mutate(draft.id)}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}
