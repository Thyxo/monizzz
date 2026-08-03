'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, LogOut, PlayCircle, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { formatAmount } from '@/lib/format';
import SelectField from './SelectField';

export default function SettingsView() {
  const { user, setUser, logout } = useAppStore();
  const [accentColor, setAccentColor] = useState(user?.themeAccentColor || '#10b981');
  const [bgColor, setBgColor] = useState(user?.themeBgColor || '#0a0a0a');
  const [greetingStyle, setGreetingStyle] = useState(user?.greetingStyle || 'Hej, {navn}');
  const [savingGreeting, setSavingGreeting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleAmount, setNewRuleAmount] = useState('');
  const [newRuleDay, setNewRuleDay] = useState('1');
  const [newRuleSource, setNewRuleSource] = useState('');
  const [newRuleDest, setNewRuleDest] = useState('');
  const [ruleLoading, setRuleLoading] = useState(false);
  const [cronStatus, setCronStatus] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [greetingOpen, setGreetingOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [accData, rulesData] = await Promise.all([
        api.accounts.list(),
        api.autoRules.list(),
      ]);
      setAccounts(accData.accounts);
      setRules(rulesData.rules);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveTheme = async () => {
    setSaving(true);
    try {
      const data = await api.settings.update({ themeAccentColor: accentColor, themeBgColor: bgColor });
      setUser(data.user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveGreeting = async () => {
    setSavingGreeting(true);
    try {
      const data = await api.settings.update({ greetingStyle });
      setUser(data.user);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingGreeting(false);
    }
  };

  const handleUpdateRule = async (rule: any) => {
    setRuleLoading(true);
    try {
      const updated = await api.autoRules.update({
        id: rule.id,
        sourceAccountId: rule.sourceAccountId || null,
        destAccountId: rule.destAccountId || null,
        amount: rule.amount,
        dayOfMonth: rule.dayOfMonth,
        name: rule.name,
      });
      setRules(rules.map((r) => (r.id === updated.rule.id ? updated.rule : r)));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRuleLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Slet denne regel?')) return;
    setRuleLoading(true);
    try {
      await api.autoRules.delete(id);
      setRules(rules.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRuleLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRuleName || !newRuleAmount) return;
    setRuleLoading(true);
    try {
      const data = await api.autoRules.create({
        name: newRuleName,
        amount: parseFloat(newRuleAmount.replace(',', '.')),
        dayOfMonth: parseInt(newRuleDay) || 1,
        sourceAccountId: newRuleSource || undefined,
        destAccountId: newRuleDest || undefined,
      });
      setRules([...rules, data.rule]);
      setNewRuleName('');
      setNewRuleAmount('');
      setNewRuleDay('1');
      setNewRuleSource('');
      setNewRuleDest('');
      setShowNewRule(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRuleLoading(false);
    }
  };

  const runCronManually = async () => {
    try {
      const data = await api.cronRun();
      setCronStatus(`Kørte ${data.results.length} regler`);
      await loadData();
    } catch (err: any) {
      setCronStatus(`Fejl: ${err.message}`);
    }
  };

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

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
  };

  const sectionTitle: React.CSSProperties = {
    color: 'var(--fg)',
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
      <h2 className="text-2xl font-bold mb-6 tracking-tight" style={sectionTitle}>Indstillinger</h2>

      {/* Theme */}
      <div className="mb-8">
        <button
          onClick={() => setThemeOpen(!themeOpen)}
          className="w-full flex items-center justify-between bg-transparent border-0 p-0 cursor-pointer"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
            Tema
          </h3>
          <ChevronDown
            size={16}
            style={{ color: 'var(--fg-muted)', transform: themeOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </button>
        {themeOpen && (
          <div className="mt-3">
            <div className="grid grid-cols-4 gap-2 mb-4">
              {colorPresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => { setAccentColor(preset.accent); setBgColor(preset.bg); }}
                  className="rounded-xl p-2 text-center text-xs active:scale-[0.95] transition-transform"
                  style={{
                    backgroundColor: preset.bg,
                    border: '2px solid',
                    borderColor: accentColor === preset.accent && bgColor === preset.bg
                      ? preset.accent
                      : 'var(--border)',
                    color: preset.accent,
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full mx-auto mb-1"
                    style={{ backgroundColor: preset.accent }}
                  />
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm w-20" style={{ color: 'var(--fg-muted)' }}>Accent</label>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <span className="text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>{accentColor}</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm w-20" style={{ color: 'var(--fg-muted)' }}>Baggrund</label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <span className="text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>{bgColor}</span>
            </div>
            <button
              onClick={saveTheme}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {saving ? 'Gemmer...' : 'Gem tema'}
            </button>
          </div>
        )}
      </div>

      {/* Greeting */}
      <div className="mb-8">
        <button
          onClick={() => setGreetingOpen(!greetingOpen)}
          className="w-full flex items-center justify-between bg-transparent border-0 p-0 cursor-pointer"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
            Hilsen
          </h3>
          <ChevronDown
            size={16}
            style={{ color: 'var(--fg-muted)', transform: greetingOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </button>
        {greetingOpen && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {greetingPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setGreetingStyle(preset)}
                  className="rounded-xl py-2 px-3 text-left text-sm active:scale-[0.98] transition-transform"
                  style={{
                    backgroundColor: 'var(--card)',
                    border: '2px solid',
                    borderColor: greetingStyle === preset ? 'var(--accent)' : 'var(--border)',
                    color: 'var(--fg)',
                  }}
                >
                  {preset.replace('{navn}', user?.username || 'dig')}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={greetingStyle}
              onChange={(e) => setGreetingStyle(e.target.value)}
              placeholder="Egen hilsen, brug {navn} for dit brugernavn"
              className="w-full px-4 py-3 rounded-xl text-base outline-none mb-3"
              style={inputStyle}
            />
            <button
              onClick={saveGreeting}
              disabled={savingGreeting}
              className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {savingGreeting ? 'Gemmer...' : 'Gem hilsen'}
            </button>
          </div>
        )}
      </div>

      {/* Auto rules */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
            Automatiske regler
          </h3>
          <button
            onClick={() => setShowNewRule(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-[0.95] transition-transform"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>

        {rules.map((rule) => (
          <div
            key={rule.id}
            className="p-4 rounded-2xl mb-2"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 2px 10px -6px rgba(0,0,0,0.3)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{rule.name}</p>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                  {formatAmount(rule.amount)} d. {rule.dayOfMonth}. i måneden
                </p>
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' }}
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="space-y-2">
              <SelectField
                value={rule.sourceAccountId || ''}
                onChange={(e) => handleUpdateRule({ ...rule, sourceAccountId: e.target.value || null })}
                className="!py-2 !text-sm"
                style={inputStyle}
              >
                <option value="">Ingen kilde</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatAmount(a.balance)})</option>
                ))}
              </SelectField>
              <div className="flex items-center justify-center">
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>→</span>
              </div>
              <SelectField
                value={rule.destAccountId || ''}
                onChange={(e) => handleUpdateRule({ ...rule, destAccountId: e.target.value || null })}
                className="!py-2 !text-sm"
                style={inputStyle}
              >
                <option value="">Ud af systemet (fx donation)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatAmount(a.balance)})</option>
                ))}
              </SelectField>
            </div>
          </div>
        ))}

        {rules.length === 0 && !showNewRule && (
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Ingen automatiske regler. Tryk + for at oprette en.
          </p>
        )}

        {/* Manual cron trigger */}
        {rules.length > 0 && (
          <button
            onClick={runCronManually}
            className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
          >
            <PlayCircle size={16} />
            Kør manuelle posteringer nu
          </button>
        )}
        {cronStatus && (
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--fg-muted)' }}>{cronStatus}</p>
        )}
      </div>

      {/* New rule modal */}
      {showNewRule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowNewRule(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl pt-3 px-6 pb-6 max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 -12px 40px -12px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4 sm:hidden" style={{ backgroundColor: 'var(--border)' }} />
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>Ny automatisk regel</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Navn (f.eks. Opsparing)"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
                autoFocus
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="Beløb (f.eks. 250)"
                value={newRuleAmount}
                onChange={(e) => setNewRuleAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="Dag i måneden (1-28)"
                value={newRuleDay}
                onChange={(e) => setNewRuleDay(e.target.value)}
                min="1"
                max="28"
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={inputStyle}
              />
              <SelectField
                value={newRuleSource}
                onChange={(e) => setNewRuleSource(e.target.value)}
                style={inputStyle}
              >
                <option value="">Ingen kilde-konto</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </SelectField>
              <SelectField
                value={newRuleDest}
                onChange={(e) => setNewRuleDest(e.target.value)}
                style={inputStyle}
              >
                <option value="">Ud af systemet (fx donation)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </SelectField>
              <button
                onClick={handleCreateRule}
                disabled={ruleLoading || !newRuleName || !newRuleAmount}
                className="w-full py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Opret regel
              </button>
              <button
                onClick={() => setShowNewRule(false)}
                className="w-full py-2.5 rounded-xl text-sm"
                style={{ color: 'var(--fg-muted)' }}
              >
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--fg-muted)' }}>
          Konto
        </h3>
        <p className="text-sm mb-1" style={{ color: 'var(--fg)' }}>
          Brugernavn: <strong>{user?.username}</strong>
        </p>
        <button
          onClick={logout}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
        >
          <LogOut size={15} />
          Log ud
        </button>
      </div>
    </div>
  );
}