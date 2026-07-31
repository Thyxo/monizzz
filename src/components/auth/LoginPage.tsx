'use client';

import { useState } from 'react';
import { useAppStore } from '@/store';
import { api } from '@/lib/api';

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
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || 'Der opstod en fejl');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            monizzz
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--fg-muted)' }}>
            {isRegister ? 'Opret en ny bruger' : 'Log ind på din konto'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Brugernavn"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all duration-200 focus:ring-2"
              style={{
                backgroundColor: 'var(--card)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
                focusRingColor: 'var(--accent)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              autoComplete="username"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all duration-200 focus:ring-2"
              style={{
                backgroundColor: 'var(--card)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl font-semibold text-base transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            {loading ? 'Vent...' : isRegister ? 'Opret konto' : 'Log ind'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: 'var(--fg-muted)' }}>
          {isRegister ? 'Har allerede en konto?' : 'Ingen konto?'}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
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
