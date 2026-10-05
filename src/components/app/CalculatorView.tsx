'use client';

import { Delete } from 'lucide-react';
import { useAppStore, useCalculatorStore } from '@/store';
import { useOnline } from '@/lib/queries';
import { Header } from '@/components/app/ui';

// The store keeps numbers with '.'; the comma only exists on screen.
const show = (value: string) => value.replace('.', ',');

function compute(a: number, b: number, operator: string): number {
  switch (operator) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : 0;
    default: return b;
  }
}

// Trims floating point noise such as 0.1 + 0.2 = 0.30000000000000004.
const tidy = (value: number) => String(parseFloat(value.toFixed(8)));

export default function CalculatorView() {
  const openSheet = useAppStore((state) => state.openSheet);
  const { display, previous, operator, resetNext, set, clear } = useCalculatorStore();
  const online = useOnline();

  const input = (digit: string) => {
    if (resetNext) {
      set({ display: digit === '.' ? '0.' : digit, resetNext: false });
    } else if (digit === '.') {
      if (!display.includes('.')) set({ display: display + '.' });
    } else if (display.replace('-', '').replace('.', '').length < 12) {
      set({ display: display === '0' ? digit : display === '-0' ? '-' + digit : display + digit });
    }
  };

  const backspace = () => {
    if (resetNext) return;
    const next = display.slice(0, -1);
    set({ display: next === '' || next === '-' ? '0' : next });
  };

  const applyOperator = (next: string) => {
    const current = parseFloat(display);
    if (previous !== null && operator && !resetNext) {
      const result = tidy(compute(parseFloat(previous), current, operator));
      set({ previous: result, display: result, operator: next, resetNext: true });
    } else {
      set({ previous: tidy(current), operator: next, resetNext: true });
    }
  };

  const equals = () => {
    if (previous === null || !operator) return;
    const result = tidy(compute(parseFloat(previous), parseFloat(display), operator));
    set({ display: result, previous: null, operator: null, resetNext: true });
  };

  const negate = () => {
    if (parseFloat(display) !== 0) set({ display: display.startsWith('-') ? display.slice(1) : '-' + display });
  };

  const value = parseFloat(display);
  const send = () =>
    openSheet({
      kind: value < 0 ? 'expense' : 'income',
      amount: Math.round(Math.abs(value) * 100) / 100,
      note: 'Fra lommeregner',
    });

  const numberStyle = { backgroundColor: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)' };
  const softStyle = { backgroundColor: 'rgba(148,163,184,0.15)', color: 'var(--fg)' };
  const operatorStyle = (symbol: string) =>
    operator === symbol && resetNext
      ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
      : { ...softStyle, color: 'var(--accent)' };
  const key = 'pressable h-16 rounded-2xl text-2xl font-semibold flex items-center justify-center';

  const digits = (numbers: number[]) =>
    numbers.map((n) => (
      <button key={n} onClick={() => input(String(n))} className={key} style={numberStyle}>{n}</button>
    ));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title="Lommeregner" />

      <div className="flex flex-1 flex-col justify-end px-4 pb-2">
        <p className="h-5 truncate text-right text-sm" style={{ color: 'var(--fg-muted)' }}>
          {previous !== null && operator ? `${show(previous)} ${operator}` : ''}
        </p>
        <div className="truncate py-2 text-right font-bold" style={{ fontSize: display.length > 10 ? '2.25rem' : '3.25rem', lineHeight: 1.1 }}>
          {show(display)}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-3">
        <button className="btn btn-accent w-full" disabled={!online || !value} onClick={send}>
          Send til konto →
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-2 px-4 pb-4">
        <button onClick={clear} className={key} style={softStyle}>C</button>
        <button onClick={backspace} aria-label="Slet tegn" className={key} style={softStyle}><Delete size={24} /></button>
        <button onClick={negate} className={key} style={softStyle}>±</button>
        <button onClick={() => applyOperator('÷')} className={key} style={operatorStyle('÷')}>÷</button>

        {digits([7, 8, 9])}
        <button onClick={() => applyOperator('×')} className={key} style={operatorStyle('×')}>×</button>

        {digits([4, 5, 6])}
        <button onClick={() => applyOperator('-')} className={key} style={operatorStyle('-')}>−</button>

        {digits([1, 2, 3])}
        <button onClick={() => applyOperator('+')} className={key} style={operatorStyle('+')}>+</button>

        <button onClick={() => input('0')} className={`${key} col-span-2`} style={numberStyle}>0</button>
        <button onClick={() => input('.')} className={key} style={numberStyle}>,</button>
        <button onClick={equals} className={key} style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}>=</button>
      </div>
    </div>
  );
}
