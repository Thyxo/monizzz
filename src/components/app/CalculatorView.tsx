'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import SelectField from './SelectField';

export default function CalculatorView() {
  const { accounts } = useAppStore();
  const [display, setDisplay] = useState('0');
  const [previous, setPrevious] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendMode, setSendMode] = useState<'add' | 'subtract'>('add');
  const [sendAccountId, setSendAccountId] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [sending, setSending] = useState(false);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const displayRef = useRef<HTMLDivElement>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.accounts.list();
      setAllAccounts(data.accounts);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const input = (val: string) => {
    if (resetNext) {
      setDisplay(val === '.' ? '0.' : val);
      setResetNext(false);
    } else {
      if (val === '.' && display.includes('.')) return;
      if (display === '0' && val !== '.') {
        setDisplay(val);
      } else {
        setDisplay(display + val);
      }
    }
  };

  const backspace = () => {
    if (resetNext) return;
    if (display.length <= 1 || (display.length === 2 && display[0] === '-')) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const calc = (op: string) => {
    const current = parseFloat(display.replace(',', '.'));
    if (previous !== null && operator) {
      const prev = parseFloat(previous);
      let result: number;
      switch (operator) {
        case '+': result = prev + current; break;
        case '-': result = prev - current; break;
        case '×': result = prev * current; break;
        case '÷': result = current !== 0 ? prev / current : 0; break;
        default: result = current;
      }
      setPrevious(String(result));
      setDisplay(String(result).replace('.', ','));
    } else {
      setPrevious(display.replace(',', '.'));
    }
    setOperator(op);
    setResetNext(true);
  };

  const equals = () => {
    if (previous === null || !operator) return;
    calc(operator);
    setOperator(null);
    setPrevious(null);
    setResetNext(true);
  };

  const clear = () => {
    setDisplay('0');
    setPrevious(null);
    setOperator(null);
    setResetNext(false);
  };

  const handleSend = async () => {
    if (!sendAccountId || sending) return;
    const val = parseFloat(display.replace(',', '.'));
    if (isNaN(val)) return;
    setSending(true);
    try {
      await api.accounts.addBalance(sendAccountId, sendMode === 'add' ? val : -val, sendNote || `Fra lommeregner: ${display}`);
      setShowSend(false);
      setSendNote('');
      await loadAccounts();
      clear();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const btnBase: React.CSSProperties = {
    backgroundColor: 'var(--card)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    boxShadow: '0 2px 8px -5px rgba(0,0,0,0.35)',
  };

  const opBtnBase: React.CSSProperties = {
    backgroundColor: 'rgba(148,163,184,0.15)',
    color: 'var(--fg)',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Display */}
      <div className="px-4 pt-6 pb-2">
        {previous && operator && (
          <p className="text-sm text-right truncate" style={{ color: 'var(--fg-muted)' }}>
            {previous.replace('.', ',')} {operator}
          </p>
        )}
        <div
          ref={displayRef}
          className="text-right text-4xl font-bold py-2 min-h-[3.5rem] flex items-end justify-end"
          style={{ color: 'var(--fg)' }}
        >
          {display}
        </div>
      </div>

      {/* Send to account button */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setShowSend(true)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          Send til konto
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Calculator grid */}
      <div className="flex-1 grid grid-cols-4 gap-2 p-4 pt-0" style={{ maxBlockSize: 'fit-content' }}>
        <button onClick={clear} className="h-14 rounded-xl text-lg font-semibold active:scale-[0.95] transition-transform" style={opBtnBase}>C</button>
        <button onClick={backspace} className="h-14 rounded-xl text-lg font-semibold active:scale-[0.95] transition-transform" style={opBtnBase}>⌫</button>
        <button onClick={() => {
          const num = parseFloat(display.replace(',', '.'));
          if (!isNaN(num)) setDisplay(String(-num).replace('.', ','));
        }} className="h-14 rounded-xl text-lg font-semibold active:scale-[0.95] transition-transform" style={opBtnBase}>±</button>
        <button onClick={() => calc('÷')} className="h-14 rounded-xl text-2xl font-semibold active:scale-[0.95] transition-transform" style={{...opBtnBase, color: 'var(--accent)'}}>÷</button>

        {[7,8,9].map(n => (
          <button key={n} onClick={() => input(String(n))} className="h-14 rounded-xl text-xl font-semibold active:scale-[0.95] transition-transform" style={btnBase}>{n}</button>
        ))}
        <button onClick={() => calc('×')} className="h-14 rounded-xl text-2xl font-semibold active:scale-[0.95] transition-transform" style={{...opBtnBase, color: 'var(--accent)'}}>×</button>

        {[4,5,6].map(n => (
          <button key={n} onClick={() => input(String(n))} className="h-14 rounded-xl text-xl font-semibold active:scale-[0.95] transition-transform" style={btnBase}>{n}</button>
        ))}
        <button onClick={() => calc('-')} className="h-14 rounded-xl text-2xl font-semibold active:scale-[0.95] transition-transform" style={{...opBtnBase, color: 'var(--accent)'}}>−</button>

        {[1,2,3].map(n => (
          <button key={n} onClick={() => input(String(n))} className="h-14 rounded-xl text-xl font-semibold active:scale-[0.95] transition-transform" style={btnBase}>{n}</button>
        ))}
        <button onClick={() => calc('+')} className="h-14 rounded-xl text-2xl font-semibold active:scale-[0.95] transition-transform" style={{...opBtnBase, color: 'var(--accent)'}}>+</button>

        <button onClick={() => input('0')} className="col-span-2 h-14 rounded-xl text-xl font-semibold active:scale-[0.95] transition-transform" style={btnBase}>0</button>
        <button onClick={() => input('.')} className="h-14 rounded-xl text-xl font-semibold active:scale-[0.95] transition-transform" style={btnBase}>,</button>
        <button onClick={equals} className="h-14 rounded-xl text-xl font-semibold active:scale-[0.95] transition-transform" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}>=</button>
      </div>

      {/* Send to account modal */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowSend(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl pt-3 px-6 pb-6"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 -12px 40px -12px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4 sm:hidden" style={{ backgroundColor: 'var(--border)' }} />
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Send til konto</h3>
            <p className="text-2xl font-bold mb-4" style={{ color: 'var(--accent)' }}>{display} kr</p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSendMode('add')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: sendMode === 'add' ? '#10b981' : 'rgba(148,163,184,0.1)',
                  color: sendMode === 'add' ? '#fff' : 'var(--fg)',
                }}
              >
                + Indsæt
              </button>
              <button
                onClick={() => setSendMode('subtract')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: sendMode === 'subtract' ? '#ef4444' : 'rgba(148,163,184,0.1)',
                  color: sendMode === 'subtract' ? '#fff' : 'var(--fg)',
                }}
              >
                - Hæv
              </button>
            </div>

            <SelectField
              value={sendAccountId}
              onChange={(e) => setSendAccountId(e.target.value)}
              className="mb-3"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }}
            >
              <option value="">Vælg konto...</option>
              {allAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </SelectField>

            <input
              type="text"
              placeholder="Note (valgfrit)"
              value={sendNote}
              onChange={(e) => setSendNote(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base outline-none mb-4"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }}
            />

            <button
              onClick={handleSend}
              disabled={sending || !sendAccountId}
              className="w-full py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {sending ? 'Sender...' : 'Send'}
            </button>
            <button
              onClick={() => setShowSend(false)}
              className="w-full py-2.5 rounded-xl text-sm mt-1"
              style={{ color: 'var(--fg-muted)' }}
            >
              Annuller
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
