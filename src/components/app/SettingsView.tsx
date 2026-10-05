'use client';

import { useState } from 'react';
import { ChevronDown, Download, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { clearCache, useAccounts, useAction, useOnline } from '@/lib/queries';
import { downloadCsv, transactionsToCsv } from '@/lib/csv';
import { DEFAULT_GREETING, HOME_WIDGETS, hiddenWidgets, toDateInput } from '@/lib/format';
import { Header } from '@/components/app/ui';

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

const greetingPresets = [
  'Hej, {navn}',
  'Godmorgen, {navn}',
  'Goddag, {navn}',
  'Halløj, {navn}',
  'Yo {navn}!',
  'Kære {navn}',
  'Hvad så, {navn}?',
  'Velkommen tilbage, {navn}',
];

// A settings section that stays folded until its title is tapped.
function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6">
      <button className="flex w-full items-center justify-between py-1" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="label">{title}</span>
        <ChevronDown
          size={16}
          style={{ color: 'var(--fg-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function SettingsView() {
  const { user, setUser, logout } = useAppStore();
  const online = useOnline();
  const { accounts } = useAccounts();

  const [accentColor, setAccentColor] = useState(user?.themeAccentColor || '#10b981');
  const [bgColor, setBgColor] = useState(user?.themeBgColor || '#0a0a0a');
  const [greetingStyle, setGreetingStyle] = useState(user?.greetingStyle || DEFAULT_GREETING);
  const [exporting, setExporting] = useState(false);

  const themeChanged = accentColor !== user?.themeAccentColor || bgColor !== user?.themeBgColor;
  const saveTheme = useAction(() => api.settings.update({ themeAccentColor: accentColor, themeBgColor: bgColor }), {
    success: 'Tema gemt',
    onDone: (data) => setUser(data.user),
  });

  const greetingChanged = greetingStyle.trim() !== (user?.greetingStyle || DEFAULT_GREETING);
  const saveGreeting = useAction(() => api.settings.update({ greetingStyle: greetingStyle.trim() }), {
    success: 'Hilsen gemt',
    onDone: (data) => setUser(data.user),
  });

  // The home-screen choices save as soon as they are tapped.
  const saveHome = useAction(
    (data: { defaultAccountId?: string | null; hiddenWidgets?: string }) => api.settings.update(data),
    { onDone: (data) => setUser(data.user) },
  );
  const hidden = hiddenWidgets(user);
  const defaultAccountId = accounts.find((account) => account.id === user?.defaultAccountId)?.id || '';

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
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title="Indstillinger" />
      <div className="scroll-area px-4 pb-6">
        <p className="label mb-1.5">Standardkonto</p>
        <select
          className="field"
          value={defaultAccountId}
          disabled={!online || saveHome.isPending}
          onChange={(e) => saveHome.mutate({ defaultAccountId: e.target.value || null })}
        >
          <option value="">Ingen (den første konto)</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
        <p className="mb-6 mt-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
          Den konto, der er valgt på forhånd, når du hæver eller indsætter penge.
        </p>

        <p className="label mb-1.5">Vis på Hjem</p>
        <div className="card mb-6 divide-y" style={{ borderColor: 'var(--border)' }}>
          {HOME_WIDGETS.map((widget) => {
            const shown = !hidden.includes(widget.key);
            return (
              <button
                key={widget.key}
                role="switch"
                aria-checked={shown}
                disabled={!online || saveHome.isPending}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
                style={{ borderColor: 'var(--border)', opacity: 1 }}
                onClick={() =>
                  saveHome.mutate({
                    hiddenWidgets: (shown ? [...hidden, widget.key] : hidden.filter((key) => key !== widget.key)).join(','),
                  })
                }
              >
                {widget.label}
                <span
                  className="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors"
                  style={{ backgroundColor: shown ? 'var(--accent)' : 'rgba(148, 163, 184, 0.3)' }}
                >
                  <span
                    className="h-5 w-5 rounded-full bg-white transition-transform"
                    style={{ transform: shown ? 'translateX(20px)' : 'none' }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        <Collapsible title="Tema">
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
        </Collapsible>

        <Collapsible title="Hilsen">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {greetingPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setGreetingStyle(preset)}
                className="pressable rounded-xl px-3 py-2 text-left text-sm"
                style={{
                  backgroundColor: 'var(--card)',
                  border: `2px solid ${greetingStyle === preset ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {preset.replace('{navn}', user?.username || 'dig')}
              </button>
            ))}
          </div>
          <input
            className="field mb-3"
            maxLength={60}
            placeholder="Egen hilsen, brug {navn} for dit brugernavn"
            value={greetingStyle}
            onChange={(e) => setGreetingStyle(e.target.value)}
          />
          <button
            className="btn btn-accent w-full"
            disabled={!greetingStyle.trim() || !greetingChanged || saveGreeting.isPending || !online}
            onClick={() => saveGreeting.mutate(undefined)}
          >
            {saveGreeting.isPending ? 'Gemmer...' : 'Gem hilsen'}
          </button>
        </Collapsible>

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
    </div>
  );
}
