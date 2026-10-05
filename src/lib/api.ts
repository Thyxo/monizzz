const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export const TOKEN_KEY = 'monizzz_token';

let onUnauthorized: () => void = () => {};
// The store registers its logout here so an expired session returns to the login screen without a reload.
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    const preview = text.replace(/\s+/g, ' ').slice(0, 120);
    throw new HttpError(res.status, `API svarer ikke med JSON (${res.status} ${res.statusText}) fra ${res.url}. Svar: ${preview}`);
  }

  const data = await res.json();
  if (res.status === 401 && token && !path.startsWith('/api/auth/login')) {
    onUnauthorized();
  }
  if (!res.ok) throw new HttpError(res.status, data.error || 'Ukendt fejl');
  return data as T;
}

function query(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export type TransactionFilter = {
  accountId?: string;
  categoryId?: string;
  kind?: 'income' | 'expense' | 'transfer' | '';
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type RuleInput = {
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  nextDate: string; // yyyy-MM-dd, the first booking
  sourceAccountId?: string | null;
  destAccountId?: string | null;
  categoryId?: string | null;
};

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: any }>('/api/auth/login', { method: 'POST', body: { username, password } }),
    register: (username: string, password: string) =>
      request<{ token: string; user: any }>('/api/auth/register', { method: 'POST', body: { username, password } }),
    me: () => request<{ user: any }>('/api/auth/me'),
  },
  accounts: {
    list: () => request<{ accounts: any[] }>('/api/accounts'),
    create: (data: { name: string; type: string; balance?: number; targetAmount?: number }) =>
      request<{ account: any }>('/api/accounts', { method: 'POST', body: data }),
    rename: (id: string, name: string) => request<{ account: any }>('/api/accounts', { method: 'PUT', body: { id, name } }),
    delete: (id: string) => request(`/api/accounts?id=${id}`, { method: 'DELETE' }),
    transfer: (data: { sourceAccountId: string; destAccountId: string; amount: number; note?: string; date?: string }) =>
      request('/api/accounts/transfer', { method: 'POST', body: data }),
  },
  transactions: {
    list: (filter: TransactionFilter) =>
      request<{ transactions: any[]; total: number }>(`/api/transactions${query(filter)}`),
    create: (data: { accountId: string; amount: number; note?: string; categoryId?: string | null; date?: string }) =>
      request<{ account: any; transaction: any }>('/api/transactions', { method: 'POST', body: data }),
    update: (data: { id: string; amount?: number; note?: string | null; categoryId?: string | null; date?: string }) =>
      request<{ transaction: any }>('/api/transactions', { method: 'PUT', body: data }),
    delete: (id: string) => request(`/api/transactions?id=${id}`, { method: 'DELETE' }),
  },
  categories: {
    list: () => request<{ categories: any[] }>('/api/categories'),
    create: (data: { name: string; kind: string; color: string; icon: string }) =>
      request<{ category: any }>('/api/categories', { method: 'POST', body: data }),
    update: (data: { id: string; name?: string; color?: string; icon?: string; sortOrder?: number }) =>
      request<{ category: any }>('/api/categories', { method: 'PUT', body: data }),
    delete: (id: string) => request(`/api/categories?id=${id}`, { method: 'DELETE' }),
  },
  goals: {
    update: (accountId: string, targetAmount: number) =>
      request<{ goal: any }>('/api/goals', { method: 'PUT', body: { accountId, targetAmount } }),
  },
  settings: {
    update: (data: { themeAccentColor?: string; themeBgColor?: string }) =>
      request<{ user: any }>('/api/settings', { method: 'PUT', body: data }),
  },
  autoRules: {
    list: () => request<{ rules: any[] }>('/api/auto-rules'),
    create: (data: RuleInput) => request<{ rule: any }>('/api/auto-rules', { method: 'POST', body: data }),
    update: (data: Partial<RuleInput> & { id: string }) =>
      request<{ rule: any }>('/api/auto-rules', { method: 'PUT', body: data }),
    delete: (id: string) => request(`/api/auto-rules?id=${id}`, { method: 'DELETE' }),
    run: () => request<{ results: { rule: string; date: string; status: string }[] }>('/api/auto-rules/run', { method: 'POST' }),
  },
};
