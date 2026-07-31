'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Home as HomeIcon, WalletCards, Target, Calculator as CalculatorIcon, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import LoginPage from '@/components/auth/LoginPage';
import OverviewView from '@/components/app/OverviewView';
import AccountsView from '@/components/app/AccountsView';
import GoalsView from '@/components/app/GoalsView';
import CalculatorView from '@/components/app/CalculatorView';
import SettingsView from '@/components/app/SettingsView';

type Tab = 'overview' | 'accounts' | 'goals' | 'calculator' | 'settings';

const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Oversigt', icon: HomeIcon },
  { key: 'accounts', label: 'Konti', icon: WalletCards },
  { key: 'goals', label: 'Mål', icon: Target },
  { key: 'calculator', label: 'Regner', icon: CalculatorIcon },
  { key: 'settings', label: 'Indstill.', icon: SettingsIcon },
];

export default function Home() {
  const { token, user, activeTab, setActiveTab, setToken, setUser, accounts, setAccounts } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);
  // Compute theme CSS variables
  const themeVars = useMemo(() => {
    const accent = user?.themeAccentColor || '#10b981';
    const bg = user?.themeBgColor || '#0a0a0a';
    const bgRGB = hexToRgb(bg);
    const accentRGB = hexToRgb(accent);
    const dark = isBgDark(bg);
    return {
      '--accent': accent,
      '--accent-fg': dark ? '#ffffff' : '#000000',
      '--accent-rgb': `${accentRGB.r}, ${accentRGB.g}, ${accentRGB.b}`,
      '--bg': bg,
      '--bg-rgb': `${bgRGB.r}, ${bgRGB.g}, ${bgRGB.b}`,
      '--fg': dark ? '#f1f5f9' : '#0f172a',
      '--fg-muted': dark ? '#94a3b8' : '#64748b',
      '--card': dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      '--border': dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    } as React.CSSProperties;
  }, [user?.themeAccentColor, user?.themeBgColor]);

  const isDark = useMemo(() => isBgDark(user?.themeBgColor || '#0a0a0a'), [user?.themeBgColor]);

  // Keep the browser/PWA status bar in sync with the user's chosen theme. This also mirrors
  // themeVars onto :root so <body>'s background (set in globals.css) matches too — otherwise
  // body stays on its default dark color and shows through as a black bar behind the notch/
  // status bar area, since the themed background was only ever applied to a nested div.
  useEffect(() => {
    const bg = user?.themeBgColor || '#0a0a0a';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);

    const root = document.documentElement.style;
    Object.entries(themeVars).forEach(([key, value]) => {
      root.setProperty(key, value as string);
    });
  }, [themeVars, user?.themeBgColor]);

  // Check auth on mount
  const swRegistered = useRef(false);
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const data = await api.auth.me();
          setUser(data.user);
        } catch {
          setToken(null);
        }
      }
      setAuthChecked(true);
    };
    checkAuth();

    // Register service worker for PWA
    if (!swRegistered.current && 'serviceWorker' in navigator) {
      swRegistered.current = true;
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Load accounts when user is set
  useEffect(() => {
    if (user && token) {
      api.accounts.list().then((data) => setAccounts(data.accounts)).catch(console.error);
    }
  }, [user, token]);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="animate-pulse text-xl" style={{ color: '#94a3b8' }}>
          monizzz
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <LoginPage />;
  }

  const renderView = () => {
    switch (activeTab) {
      case 'overview': return <OverviewView />;
      case 'accounts': return <AccountsView />;
      case 'goals': return <GoalsView />;
      case 'calculator': return <CalculatorView />;
      case 'settings': return <SettingsView />;
    }
  };

  return (
    <div
      className="flex flex-col h-dvh overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", Roboto, sans-serif',
        ...themeVars,
      }}
    >
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderView()}
      </div>

      {/* Bottom tab bar */}
      <nav
        className="shrink-0 flex items-stretch gap-1 border-t px-2 pt-1.5"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)',
          minHeight: '64px',
          boxShadow: '0 -8px 24px -12px rgba(0,0,0,0.35)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex flex-col items-center justify-center py-1.5 gap-1 rounded-xl active:scale-[0.95] transition-all duration-150"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                backgroundColor: isActive ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function isBgDark(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}
