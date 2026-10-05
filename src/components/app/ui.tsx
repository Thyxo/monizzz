'use client';

import { createElement, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { ArrowLeftRight, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { addMonths } from 'date-fns';
import { UNCATEGORISED, categoryIcon } from '@/lib/icons';
import { accountColor, formatAmountShort, formatMonth, txKind, txTitle } from '@/lib/format';
import { tint } from '@/lib/theme';
import AccountIcon from '@/components/app/AccountIcon';

/** Bottom sheet that can be dragged down to close. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl outline-none"
          style={{ backgroundColor: 'var(--sheet)', color: 'var(--fg)', borderTop: '1px solid var(--border)' }}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
          <Drawer.Title className="px-5 pt-3 pb-1 text-lg font-bold">{title}</Drawer.Title>
          <div
            className="overflow-y-auto px-5 pt-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)', overscrollBehavior: 'contain' }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function ConfirmSheet({
  open,
  onClose,
  title,
  text,
  confirmLabel,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-5 text-sm" style={{ color: 'var(--fg-muted)' }}>{text}</p>
      <div className="flex gap-2">
        <button className="btn btn-soft flex-1" onClick={onClose}>Annuller</button>
        <button
          className="btn flex-1"
          style={{ backgroundColor: 'var(--expense)', color: '#fff' }}
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--card)' }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-fg)' : 'var(--fg-muted)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Header({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
      {left}
      <h1 className="flex-1 truncate text-2xl font-bold">{title}</h1>
      {right}
    </div>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  accent,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      style={
        accent
          ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
          : { backgroundColor: 'var(--card)', color: 'var(--fg)' }
      }
    >
      <Icon size={20} />
    </button>
  );
}

export function MonthNav({ month, onChange }: { month: Date; onChange: (month: Date) => void }) {
  return (
    <div className="flex items-center justify-between">
      <button aria-label="Forrige måned" className="pressable p-2" onClick={() => onChange(addMonths(month, -1))}>
        <ChevronLeft size={20} />
      </button>
      <span className="text-base font-semibold" style={{ color: 'var(--accent)' }}>{formatMonth(month)}</span>
      <button aria-label="Næste måned" className="pressable p-2" onClick={() => onChange(addMonths(month, 1))}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

export function CategoryIcon({ category, size = 40 }: { category?: { color: string; icon: string } | null; size?: number }) {
  const { color, icon } = category || UNCATEGORISED;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: color, color: '#fff' }}
    >
      {createElement(categoryIcon(icon), { size: size * 0.5 })}
    </div>
  );
}

/** The icon tile for an account, coloured by its type. */
export function AccountBadge({ type, size = 44 }: { type: string; size?: number }) {
  const color = accountColor(type);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: tint(color, 0.15) }}
    >
      <AccountIcon type={type} color={color} size={Math.round(size * 0.45)} />
    </div>
  );
}

export function TransactionRow({
  tx,
  onClick,
  showAccount = true,
}: {
  tx: any;
  onClick?: () => void;
  showAccount?: boolean;
}) {
  const kind = txKind(tx);
  const time = new Date(tx.createdAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  const details = [time, showAccount && tx.account?.name, tx.note && tx.category?.name].filter(Boolean).join(' · ');
  return (
    <button onClick={onClick} className="card pressable flex w-full items-center gap-3 p-3 text-left">
      {kind === 'transfer' ? (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: tint('#94a3b8', 0.2), color: 'var(--fg-muted)' }}
        >
          <ArrowLeftRight size={18} />
        </div>
      ) : (
        <CategoryIcon category={tx.category} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{txTitle(tx)}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs" style={{ color: 'var(--fg-muted)' }}>
          {details}
          {tx.type === 'automatic' && (
            <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: tint('#a855f7', 0.15), color: '#a855f7' }}>
              auto
            </span>
          )}
        </p>
      </div>
      <p
        className="shrink-0 text-sm font-bold"
        style={{ color: kind === 'transfer' ? 'var(--fg-muted)' : tx.amount >= 0 ? 'var(--income)' : 'var(--expense)' }}
      >
        {formatAmountShort(tx.amount)}
      </p>
    </button>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <Icon size={48} style={{ color: 'var(--fg-muted)', opacity: 0.4 }} />
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  );
}
