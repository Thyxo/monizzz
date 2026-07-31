'use client';

import { ChevronDown } from 'lucide-react';

export default function SelectField({
  className = '',
  style,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full pl-4 pr-10 py-3 rounded-xl text-base outline-none appearance-none ${className}`}
        style={style}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--fg-muted)' }}
      />
    </div>
  );
}
