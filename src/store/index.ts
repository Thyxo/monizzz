import { create } from 'zustand';

type Tab = 'overview' | 'accounts' | 'goals' | 'calculator' | 'settings';

interface AppState {
  token: string | null;
  user: {
    id: string;
    username: string;
    themeAccentColor: string;
    themeBgColor: string;
  } | null;
  activeTab: Tab;
  selectedAccountId: string | null;
  accounts: any[];
  setToken: (token: string | null) => void;
  setUser: (user: AppState['user']) => void;
  setActiveTab: (tab: Tab) => void;
  setSelectedAccountId: (id: string | null) => void;
  setAccounts: (accounts: any[]) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('monizzz_token') : null,
  user: null,
  activeTab: 'overview',
  selectedAccountId: null,
  accounts: [],
  setToken: (token) => {
    if (token) {
      localStorage.setItem('monizzz_token', token);
    } else {
      localStorage.removeItem('monizzz_token');
    }
    set({ token });
  },
  setUser: (user) => set({ user }),
  setActiveTab: (activeTab) => set({ activeTab, selectedAccountId: null }),
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
  setAccounts: (accounts) => set({ accounts }),
  logout: () => {
    localStorage.removeItem('monizzz_token');
    set({ token: null, user: null, activeTab: 'overview', selectedAccountId: null, accounts: [] });
  },
}));
