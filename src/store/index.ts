import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOKEN_KEY } from '@/lib/api';

export type Tab =
  | 'home'
  | 'transactions'
  | 'overview'
  | 'calendar'
  | 'accounts'
  | 'goals'
  | 'rules'
  | 'calculator'
  | 'categories'
  | 'settings';

export type User = {
  id: string;
  username: string;
  themeAccentColor: string;
  themeBgColor: string;
  greetingStyle: string;
  // Optional: a backend that has not been updated yet does not send these.
  defaultAccountId?: string | null;
  hiddenWidgets?: string;
  navTabs?: string;
};

export type EntryKind = 'expense' | 'income' | 'transfer';

// What the add/edit sheet opens with. `transaction` set means edit mode.
export type SheetState = {
  kind?: EntryKind;
  accountId?: string;
  amount?: number;
  note?: string;
  date?: string;
  transaction?: any;
} | null;

export type TxPreset = { categoryId?: string; kind?: EntryKind; month?: string } | null;

const USER_KEY = 'monizzz_user';

function readUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

interface AppState {
  token: string | null;
  user: User | null;
  activeTab: Tab;
  selectedAccountId: string | null;
  sheet: SheetState;
  txPreset: TxPreset;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setActiveTab: (tab: Tab) => void;
  setSelectedAccountId: (id: string | null) => void;
  openAccount: (id: string) => void;
  openSheet: (sheet: NonNullable<SheetState>) => void;
  closeSheet: () => void;
  showTransactions: (preset: NonNullable<TxPreset>) => void;
  clearTxPreset: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  // Cached so the app can open offline with the last known user and theme.
  user: readUser(),
  activeTab: 'home',
  selectedAccountId: null,
  sheet: null,
  txPreset: null,
  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    set({ token });
  },
  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    set({ user });
  },
  setActiveTab: (activeTab) => set({ activeTab, selectedAccountId: null }),
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
  openAccount: (id) => set({ activeTab: 'accounts', selectedAccountId: id }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  showTransactions: (txPreset) => set({ activeTab: 'transactions', selectedAccountId: null, txPreset }),
  clearTxPreset: () => set({ txPreset: null }),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, activeTab: 'home', selectedAccountId: null, sheet: null, txPreset: null });
  },
}));

interface CalculatorState {
  display: string; // always uses '.' as decimal separator
  previous: string | null;
  operator: string | null;
  resetNext: boolean;
  set: (state: Partial<Omit<CalculatorState, 'set' | 'clear'>>) => void;
  clear: () => void;
}

const emptyCalculator = { display: '0', previous: null, operator: null, resetNext: false };

// Persisted so a half-typed calculation survives tab switches and reopening the app.
export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      ...emptyCalculator,
      set: (state) => set(state),
      clear: () => set(emptyCalculator),
    }),
    { name: 'monizzz_calculator' },
  ),
);
