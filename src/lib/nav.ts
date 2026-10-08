import {
  CalendarDays,
  Calculator,
  House,
  LayoutGrid,
  List,
  Repeat,
  Settings,
  Tags,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Tab } from '@/store';

// Every view, in the order the "Mere" menu lists the ones that are not in the bottom bar.
// `short` replaces a label that is too long for the bottom bar.
export const NAV_TABS: { key: Tab; label: string; short?: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'Hjem', icon: House },
  { key: 'accounts', label: 'Konti', icon: Wallet },
  { key: 'goals', label: 'Mål', icon: Target },
  { key: 'transactions', label: 'Transaktioner', icon: List },
  { key: 'overview', label: 'Oversigt', icon: LayoutGrid },
  { key: 'calendar', label: 'Kalender', icon: CalendarDays },
  { key: 'rules', label: 'Automatiske regler', short: 'Regler', icon: Repeat },
  { key: 'calculator', label: 'Lommeregner', icon: Calculator },
  { key: 'categories', label: 'Kategorier', icon: Tags },
  { key: 'settings', label: 'Indstillinger', icon: Settings },
];

export const NAV_SLOTS = 3;
const DEFAULT_NAV_TABS: Tab[] = ['home', 'accounts', 'goals'];

/**
 * The views in the user's bottom bar, always exactly NAV_SLOTS distinct ones. Unknown or
 * duplicate keys are dropped and missing slots are filled from the defaults, so an older
 * backend that does not send `navTabs` gives the default bar.
 */
export function navTabs(user: { navTabs?: string } | null): Tab[] {
  const known = new Set(NAV_TABS.map((tab) => tab.key));
  const chosen: Tab[] = [];
  const candidates = [...(user?.navTabs || '').split(','), ...DEFAULT_NAV_TABS, ...NAV_TABS.map((tab) => tab.key)];
  for (const key of candidates) {
    if (chosen.length === NAV_SLOTS) break;
    if (known.has(key as Tab) && !chosen.includes(key as Tab)) chosen.push(key as Tab);
  }
  return chosen;
}
