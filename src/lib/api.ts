const BASE = '';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('monizzz_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem('monizzz_token');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unknown error');
  return data as T;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ username, password }) }).then((r) => handleResponse<{ token: string; user: any }>(r)),
    register: (username: string, password: string) =>
      fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ username, password }) }).then((r) => handleResponse<{ token: string; user: any }>(r)),
    me: () => fetch(`${BASE}/api/auth/me`, { headers: getHeaders() }).then((r) => handleResponse<{ user: any }>(r)),
  },
  accounts: {
    list: () => fetch(`${BASE}/api/accounts`, { headers: getHeaders() }).then((r) => handleResponse<{ accounts: any[] }>(r)),
    create: (data: { name: string; type: string; balance?: number; targetAmount?: number }) =>
      fetch(`${BASE}/api/accounts`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then((r) => handleResponse<{ account: any }>(r)),
    delete: (id: string) => fetch(`${BASE}/api/accounts?id=${id}`, { method: 'DELETE', headers: getHeaders() }).then((r) => handleResponse<any>(r)),
    addBalance: (accountId: string, amount: number, note?: string) =>
      fetch(`${BASE}/api/accounts/add-balance`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ accountId, amount, note }) }).then((r) => handleResponse<any>(r)),
    transfer: (sourceAccountId: string, destAccountId: string, amount: number, note?: string) =>
      fetch(`${BASE}/api/accounts/transfer`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ sourceAccountId, destAccountId, amount, note }) }).then((r) => handleResponse<any>(r)),
  },
  transactions: {
    list: (accountId: string, limit?: number, offset?: number) =>
      fetch(`${BASE}/api/transactions?accountId=${accountId}&limit=${limit || 50}&offset=${offset || 0}`, { headers: getHeaders() }).then((r) => handleResponse<{ transactions: any[]; total: number }>(r)),
  },
  goals: {
    update: (accountId: string, targetAmount: number) =>
      fetch(`${BASE}/api/goals`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ accountId, targetAmount }) }).then((r) => handleResponse<{ goal: any }>(r)),
  },
  settings: {
    get: () => fetch(`${BASE}/api/settings`, { headers: getHeaders() }).then((r) => handleResponse<{ user: any }>(r)),
    update: (data: { themeAccentColor?: string; themeBgColor?: string }) =>
      fetch(`${BASE}/api/settings`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then((r) => handleResponse<{ user: any }>(r)),
  },
  autoRules: {
    list: () => fetch(`${BASE}/api/auto-rules`, { headers: getHeaders() }).then((r) => handleResponse<{ rules: any[] }>(r)),
    create: (data: { name: string; amount: number; dayOfMonth?: number; sourceAccountId?: string; destAccountId?: string }) =>
      fetch(`${BASE}/api/auto-rules`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then((r) => handleResponse<{ rule: any }>(r)),
    update: (data: { id: string; name?: string; amount?: number; dayOfMonth?: number; sourceAccountId?: string | null; destAccountId?: string | null }) =>
      fetch(`${BASE}/api/auto-rules`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then((r) => handleResponse<{ rule: any }>(r)),
    delete: (id: string) => fetch(`${BASE}/api/auto-rules?id=${id}`, { method: 'DELETE', headers: getHeaders() }).then((r) => handleResponse<any>(r)),
  },
  seed: () => fetch(`${BASE}/api/seed`, { method: 'POST' }).then((r) => handleResponse<any>(r)),
  cronRun: () => fetch(`${BASE}/api/cron/run`, { method: 'POST', headers: getHeaders() }).then((r) => handleResponse<any>(r)),
};
