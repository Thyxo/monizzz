'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';
import { clearCache } from '@/lib/queries';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fn = isRegister ? api.auth.register : api.auth.login;
      const data = await fn(username, password);
      // Never show another user's cached data.
      clearCache();
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      setError(navigator.onLine ? err.message || 'Der opstod en fejl' : 'Du er offline. Log ind kræver forbindelse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.25), rgba(var(--accent-rgb), 0.08))',
              border: '1px solid var(--border)',
            }}
          >
            <Wallet size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            monizzz
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
            {isRegister ? 'Opret en ny bruger' : 'Log ind på din konto'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Brugernavn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={40}
            className="field"
            autoComplete="username"
            autoCapitalize="none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            className="field"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />

          {error && <p className="text-center text-sm" style={{ color: 'var(--expense)' }}>{error}</p>}

          <button type="submit" disabled={loading || !username || !password} className="btn btn-accent w-full">
            {loading ? 'Vent...' : isRegister ? 'Opret konto' : 'Log ind'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>
          {isRegister ? 'Har allerede en konto?' : 'Ingen konto?'}{' '}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="underline"
            style={{ color: 'var(--accent)' }}
          >
            {isRegister ? 'Log ind' : 'Opret konto'}
          </button>
        </p>
      </div>
    </div>
  );
}
