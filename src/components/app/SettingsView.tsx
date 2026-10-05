'use client';

import { useState } from 'react';
import { ArrowRight, Download, LogOut, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { clearCache, useAccounts, useAction, useCategories, useOnline, useRules } from '@/lib/queries';
import { downloadCsv, transactionsToCsv } from '@/lib/csv';
import { formatAmount, parseAmount, toDateInput } from '@/lib/format';
import { ConfirmSheet, Header, Sheet } from '@/components/app/ui';

const colorPresets = [
  { accent: '#10b981', bg: '#0a0a0a', label: 'Emerald Night' },
  { accent: '#f59e0b', bg: '#0a0a0a', label: 'Amber Night' },
  { accent: '#ec4899', bg: '#0a0a0a', label: 'Rose Night' },
  { accent: '#8b5cf6', bg: '#0a0a0a', label: 'Violet Night' },
  { accent: '#10b981', bg: '#f8fafc', label: 'Emerald Light' },
  { accent: '#f59e0b', bg: '#f8fafc', label: 'Amber Light' },
  { accent: '#ec4899', bg: '#f8fafc', label: 'Rose Light' },
  { accent: '#0ea5e9', bg: '#0f172a', label: 'Ocean' },
];

type RuleDraft = {
  id?: string;
  name: string;
  amount: string;
  day: string;
  sourceAccountId: string;
  destAccountId: string;
  categoryId: string;
};

const shortDate = (date: Date) => date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });

// Mirrors pendingDueDates() in src/lib/auto-rules.ts closely enough to tell the user when a rule books next.
function nextRun(rule: { dayOfMonth: number; lastRunAt: string | null; startFrom: string }): string {
  const today = new Date();
  const dueIn = (year: number, month: number) =>
    new Date(year, month, Math.min(rule.dayOfMonth, new Date(year, month + 1, 0).getDate()));
  const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

  let due = dueIn(today.getFullYear(), today.getMonth());
  const start = new Date(rule.startFrom);
  start.setHours(0, 0, 0, 0);
  if ((rule.lastRunAt && sameMonth(new Date(rule.lastRunAt), today)) || due < start) {
    due = dueIn(today.getFullYear(), today.getMonth() + 1);
  }
  return due <= today ? 'gang appen åbnes' : shortDate(due);
}

const emptyRule: RuleDraft = { name: '', amount: '', day: '1', sourceAccountId: '', destAccountId: '', categoryId: '' };

export default function SettingsView() {
  const { user, setUser, logout } = useAppStore();
  const online = useOnline();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { rules } = useRules();

  const [accentColor, setAccentColor] = useState(user?.themeAccentColor || '#10b981');
  const [bgColor, setBgColor] = useState(user?.themeBgColor || '#0a0a0a');
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const themeChanged = accentColor !== user?.themeAccentColor || bgColor !== user?.themeBgColor;
  const saveTheme = useAction(() => api.settings.update({ themeAccentColor: accentColor, themeBgColor: bgColor }), {
    success: 'Tema gemt',
    onDone: (data) => setUser(data.user),
  });

  const closeRule = () => {
    setDraft(null);
    setConfirmDelete(false);
  };
  const saveRule = useAction(
    (d: RuleDraft) => {
      const data = {
        name: d.name.trim(),
        amount: parseAmount(d.amount),
        dayOfMonth: parseInt(d.day) || 1,
        sourceAccountId: d.sourceAccountId || null,
        destAccountId: d.destAccountId || null,
        // A category only makes sense when money enters or leaves the system.
        categoryId: d.sourceAccountId && d.destAccountId ? null : d.categoryId || null,
      };
      return d.id ? api.autoRules.update({ id: d.id, ...data }) : api.autoRules.create(data);
    },
    { success: 'Regel gemt', onDone: closeRule },
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

  const exportAll = async () => {
    setExporting(true);
    try {
      const data = await api.transactions.list({ limit: 5000 });
      downloadCsv(`monizzz-${toDateInput(new Date())}.csv`, transactionsToCsv(data.transactions));
      toast.success(`${data.transactions.length} transaktioner eksporteret`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const ruleValid =
    draft &&
    draft.name.trim() &&
    parseAmount(draft.amount) > 0 &&
    (draft.sourceAccountId || draft.destAccountId) &&
    draft.sourceAccountId !== draft.destAccountId;
  const draftKind = draft?.sourceAccountId && draft.destAccountId ? null : draft?.destAccountId ? 'income' : 'expense';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title="Indstillinger" />
      <div className="scroll-area px-4 pb-6">
        <p className="label mb-3">Tema</p>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {colorPresets.map((preset) => {
            const active = accentColor === preset.accent && bgColor === preset.bg;
            return (
              <button
                key={preset.label}
                onClick={() => {
                  setAccentColor(preset.accent);
                  setBgColor(preset.bg);
                }}
                className="pressable rounded-xl p-2 text-center text-xs"
                style={{
                  backgroundColor: preset.bg,
                  border: `2px solid ${active ? preset.accent : 'var(--border)'}`,
                  color: preset.accent,
                }}
              >
                <div className="mx-auto mb-1 h-6 w-6 rounded-full" style={{ backgroundColor: preset.accent }} />
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="mb-4 flex gap-6">
          <label className="flex items-center gap-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
            Accent
            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
          </label>
          <label className="flex items-center gap-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
            Baggrund
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
          </label>
        </div>
        <button className="btn btn-accent w-full" disabled={!themeChanged || saveTheme.isPending || !online} onClick={() => saveTheme.mutate(undefined)}>
          {saveTheme.isPending ? 'Gemmer...' : 'Gem tema'}
        </button>

        <div className="mb-3 mt-8 flex items-center justify-between">
          <p className="label">Automatiske regler</p>
          <button
            aria-label="Ny regel"
            className="pressable flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            disabled={!online}
            onClick={() => setDraft(emptyRule)}
          >
            <Plus size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
          Regler bogføres automatisk hver måned på den valgte dag. Har appen ikke været åben, indhentes de næste gang, du åbner den.
        </p>

        {rules.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Ingen automatiske regler. Tryk + for at oprette en.</p>
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
                      day: String(rule.dayOfMonth),
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
                      : `D. ${rule.dayOfMonth}. hver måned · næste ${nextRun(rule)}`}
                  </p>
                </button>
              );
            })}
            <button className="btn btn-soft w-full" disabled={!online || runRules.isPending} onClick={() => runRules.mutate(undefined)}>
              <Play size={16} /> {runRules.isPending ? 'Kører...' : 'Kør forfaldne regler nu'}
            </button>
          </div>
        )}

        <p className="label mb-3 mt-8">Data</p>
        <button className="btn btn-soft w-full" disabled={!online || exporting} onClick={exportAll}>
          <Download size={16} /> Eksportér alle transaktioner (CSV)
        </button>

        <p className="label mb-3 mt-8">Bruger</p>
        <p className="text-sm">
          Logget ind som <strong>{user?.username}</strong>
        </p>
        <button
          className="btn btn-danger mt-4 w-full"
          onClick={() => {
            logout();
            clearCache();
          }}
        >
          <LogOut size={16} /> Log ud
        </button>
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
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <p className="label mb-1.5">Beløb</p>
                <input
                  className="field"
                  inputMode="decimal"
                  placeholder="250"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </div>
              <div className="w-32 shrink-0">
                <p className="label mb-1.5">Dag i måneden</p>
                <select className="field" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}.</option>
                  ))}
                </select>
              </div>
            </div>
            {parseInt(draft.day) > 28 && (
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                I måneder med færre dage bogføres reglen på månedens sidste dag.
              </p>
            )}
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
