'use client';

import { useMemo, useState } from 'react';
import { addDays, endOfMonth, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { useAppStore } from '@/store';
import { useMonthTransactions, useOnline } from '@/lib/queries';
import { formatAmount, formatDay, txKind } from '@/lib/format';
import { Header, MonthNav, TransactionRow } from '@/components/app/ui';

const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

export default function CalendarView() {
  const openSheet = useAppStore((state) => state.openSheet);
  const online = useOnline();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const { transactions } = useMonthTransactions(month);
  const today = startOfDay(new Date());

  const byDay = useMemo(() => {
    const map = new Map<number, { items: any[]; income: boolean; expense: boolean; transfer: boolean }>();
    for (const tx of transactions) {
      const key = startOfDay(new Date(tx.createdAt)).getTime();
      const entry = map.get(key) || { items: [], income: false, expense: false, transfer: false };
      entry.items.push(tx);
      entry[txKind(tx)] = true;
      map.set(key, entry);
    }
    return map;
  }, [transactions]);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const last = endOfMonth(month);
    const result: Date[] = [];
    for (let day = first; day <= last || result.length % 7 !== 0; day = addDays(day, 1)) result.push(day);
    return result;
  }, [month]);

  const changeMonth = (next: Date) => {
    setMonth(startOfMonth(next));
    setSelected(isSameMonth(next, today) ? today : startOfMonth(next));
  };

  const dayItems = byDay.get(selected.getTime())?.items || [];
  const dayTotal = dayItems.filter((tx) => txKind(tx) !== 'transfer').reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Kalender"
        right={
          <button className="px-2 text-sm font-semibold" style={{ color: 'var(--accent)' }} onClick={() => changeMonth(today)}>
            I dag
          </button>
        }
      />
      <div className="scroll-area px-4 pb-24">
        <MonthNav month={month} onChange={changeMonth} />

        <div className="mt-2 grid grid-cols-7 text-center">
          {WEEKDAYS.map((day, i) => (
            <p key={i} className="py-1 text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>{day}</p>
          ))}
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selected);
            const isToday = isSameDay(day, today);
            const info = byDay.get(day.getTime());
            return (
              <button
                key={day.getTime()}
                disabled={!inMonth}
                onClick={() => setSelected(day)}
                className="flex flex-col items-center py-1"
                style={{ visibility: inMonth ? 'visible' : 'hidden', opacity: 1 }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                  style={{
                    backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? 'var(--accent-fg)' : isToday ? 'var(--accent)' : 'var(--fg)',
                    fontWeight: isSelected || isToday ? 700 : 400,
                  }}
                >
                  {day.getDate()}
                </span>
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {info?.income && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--income)' }} />}
                  {info?.expense && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--expense)' }} />}
                  {info?.transfer && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--fg-muted)' }} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-2 mt-5 flex items-center justify-between">
          <p className="label">{formatDay(selected)}</p>
          {dayItems.length > 0 && (
            <p className="text-xs font-semibold" style={{ color: dayTotal >= 0 ? 'var(--income)' : 'var(--expense)' }}>
              {formatAmount(dayTotal)}
            </p>
          )}
        </div>
        {dayItems.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Ingen transaktioner denne dag</p>
            <button
              className="mt-3 text-sm font-semibold"
              style={{ color: 'var(--accent)' }}
              disabled={!online}
              onClick={() => openSheet({ kind: 'expense', date: selected.toISOString() })}
            >
              Tilføj transaktion
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dayItems.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onClick={() => openSheet({ transaction: tx })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
