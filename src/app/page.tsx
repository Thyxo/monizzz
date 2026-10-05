'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import {
  CalendarDays,
  Calculator,
  Ellipsis,
  House,
  LayoutGrid,
  List,
  Plus,
  Repeat,
  Settings,
  Tags,
  Target,
  Wallet,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore, type Tab } from '@/store';
import { HttpError, api, setUnauthorizedHandler } from '@/lib/api';
import { clearCache, queryClient, useOnline } from '@/lib/queries';
import { applyTheme, isDark } from '@/lib/theme';
import LoginPage from '@/components/auth/LoginPage';
import HomeView from '@/components/app/HomeView';
import TransactionsView from '@/components/app/TransactionsView';
import OverviewView from '@/components/app/OverviewView';
import CalendarView from '@/components/app/CalendarView';
import AccountsView from '@/components/app/AccountsView';
import GoalsView from '@/components/app/GoalsView';
import RulesView from '@/components/app/RulesView';
import CalculatorView from '@/components/app/CalculatorView';
import CategoriesView from '@/components/app/CategoriesView';
import SettingsView from '@/components/app/SettingsView';
import TransactionSheet from '@/components/app/TransactionSheet';

const mainTabs: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'Hjem', icon: House },
  { key: 'accounts', label: 'Konti', icon: Wallet },
  { key: 'goals', label: 'Mål', icon: Target },
];

const moreTabs: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'transactions', label: 'Transaktioner', icon: List },
  { key: 'overview', label: 'Oversigt', icon: LayoutGrid },
  { key: 'calendar', label: 'Kalender', icon: CalendarDays },
  { key: 'rules', label: 'Automatiske regler', icon: Repeat },
  { key: 'calculator', label: 'Lommeregner', icon: Calculator },
  { key: 'categories', label: 'Kategorier', icon: Tags },
  { key: 'settings', label: 'Indstillinger', icon: Settings },
];

const views: Record<Tab, () => React.JSX.Element> = {
  home: HomeView,
  transactions: TransactionsView,
  overview: OverviewView,
  calendar: CalendarView,
  accounts: AccountsView,
  goals: GoalsView,
  rules: RulesView,
  calculator: CalculatorView,
  categories: CategoriesView,
  settings: SettingsView,
};

const fabTabs: Tab[] = ['home', 'transactions', 'overview', 'calendar'];

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

const noopSubscribe = () => () => {};

function App() {
  const { token, user, setUser, logout } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);
  const started = useRef(false);
  // False on the server and during hydration, where the cached session is unknown.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    applyTheme(user?.themeAccentColor, user?.themeBgColor);
  }, [user?.themeAccentColor, user?.themeBgColor]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    setUnauthorizedHandler(() => {
      logout();
      clearCache();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const checkAuth = async () => {
      if (token) {
        try {
          const data = await api.auth.me();
          setUser(data.user);
        } catch (error) {
          // Offline or server trouble: keep the cached session. A 401 has already logged out.
          if (!(error instanceof HttpError && error.status === 401)) console.error(error);
        }
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  const signedIn = Boolean(token && user);

  // Book any automatic rules that have come due since the app was last open.
  useEffect(() => {
    if (!authChecked || !signedIn) return;
    api.autoRules
      .run()
      .then(({ results }) => {
        const booked = results.filter((result) => result.status !== 'error').length;
        if (booked > 0) {
          toast.success(booked === 1 ? '1 automatisk postering bogført' : `${booked} automatiske posteringer bogført`);
          queryClient.invalidateQueries();
        }
      })
      .catch(() => {});
  }, [authChecked, signedIn]);

  const dark = isDark(user?.themeBgColor || '#0a0a0a');

  return (
    <>
      <Toaster position="top-center" theme={dark ? 'dark' : 'light'} richColors closeButton={false} duration={2500} />
      {!hydrated || (!authChecked && !user) ? (
        <div className="flex h-dvh items-center justify-center">
          <div className="animate-pulse text-xl" style={{ color: 'var(--fg-muted)' }}>monizzz</div>
        </div>
      ) : signedIn ? (
        <Shell />
      ) : (
        <LoginPage />
      )}
    </>
  );
}

function Shell() {
  const { activeTab, setActiveTab, openSheet } = useAppStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const online = useOnline();
  const View = views[activeTab];
  const inMore = moreTabs.some((tab) => tab.key === activeTab);

  return (
    <div className="mx-auto flex h-dvh max-w-2xl select-none flex-col overflow-hidden">
      {!online && (
        <div
          className="flex shrink-0 items-center justify-center gap-2 py-1.5 text-xs font-medium"
          style={{ backgroundColor: 'var(--card)', color: 'var(--fg-muted)', paddingTop: 'calc(env(safe-area-inset-top) + 0.375rem)' }}
        >
          <WifiOff size={14} /> Offline – viser senest hentede data
        </div>
      )}

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <motion.div
          key={activeTab}
          className="flex flex-1 flex-col overflow-hidden"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <View />
        </motion.div>

        {fabTabs.includes(activeTab) && (
          <button
            aria-label="Ny transaktion"
            onClick={() => openSheet({ kind: 'expense' })}
            disabled={!online}
            className="pressable absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <Plus size={28} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl">
              <motion.div
                className="pointer-events-auto absolute right-3 w-56 overflow-hidden rounded-2xl p-1.5 shadow-2xl"
                style={{
                  bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
                  backgroundColor: 'var(--sheet)',
                  border: '1px solid var(--border)',
                  transformOrigin: 'bottom right',
                }}
                initial={{ opacity: 0, scale: 0.85, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 12 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {moreTabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveTab(key);
                      setMoreOpen(false);
                    }}
                    className="pressable flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium"
                    style={{
                      color: activeTab === key ? 'var(--accent)' : 'var(--fg)',
                      backgroundColor: activeTab === key ? 'var(--card)' : 'transparent',
                    }}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="relative z-50 flex shrink-0 items-stretch border-t px-1 pt-1.5"
        style={{
          backgroundColor: 'var(--sheet)',
          borderColor: 'var(--border)',
          // The extra 16px keeps the icons clear of the screen edge and the iPhone home indicator.
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          minHeight: '64px',
          boxShadow: '0 -8px 24px -12px rgba(0,0,0,0.35)',
        }}
      >
        {mainTabs.map(({ key, label, icon: Icon }) => (
          <NavButton
            key={key}
            label={label}
            icon={Icon}
            active={activeTab === key && !moreOpen}
            onClick={() => {
              setActiveTab(key);
              setMoreOpen(false);
            }}
          />
        ))}
        <NavButton label="Mere" icon={Ellipsis} active={inMore || moreOpen} onClick={() => setMoreOpen(!moreOpen)} />
      </nav>

      <TransactionSheet />
    </div>
  );
}

function NavButton({ label, icon: Icon, active, onClick }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pressable flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5"
      style={{
        color: active ? 'var(--accent)' : 'var(--fg-muted)',
        backgroundColor: active ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
      }}
    >
      <Icon size={20} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
