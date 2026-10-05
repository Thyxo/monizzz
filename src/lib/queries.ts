import { useEffect, useState } from 'react';
import { QueryClient, keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMonths, startOfMonth, subDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { api, type TransactionFilter } from '@/lib/api';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Kept long so the persisted cache can show the last known data offline.
      gcTime: WEEK,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export const PERSIST_MAX_AGE = WEEK;
export const PERSIST_KEY = 'monizzz_cache';

export function clearCache() {
  queryClient.clear();
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {}
}

export function useAccounts() {
  const result = useQuery({ queryKey: ['accounts'], queryFn: api.accounts.list });
  return { ...result, accounts: result.data?.accounts ?? [] };
}

export function useCategories() {
  const result = useQuery({ queryKey: ['categories'], queryFn: api.categories.list });
  return { ...result, categories: result.data?.categories ?? [] };
}

export function useRules() {
  const result = useQuery({ queryKey: ['rules'], queryFn: api.autoRules.list });
  return { ...result, rules: result.data?.rules ?? [] };
}

export function useTransactions(filter: TransactionFilter, enabled = true) {
  const result = useQuery({
    queryKey: ['transactions', filter],
    queryFn: () => api.transactions.list(filter),
    placeholderData: keepPreviousData,
    enabled,
  });
  return { ...result, transactions: result.data?.transactions ?? [], total: result.data?.total ?? 0 };
}

const ALL = 5000;

/** Every transaction in the calendar month that `month` falls in. */
export function useMonthTransactions(month: Date) {
  const from = startOfMonth(month);
  return useTransactions({ from: from.toISOString(), to: addMonths(from, 1).toISOString(), limit: ALL });
}

export function useRecentTransactions(days: number) {
  // Keyed by day so the query is stable across renders.
  const from = subDays(startOfDay(new Date()), days);
  return useTransactions({ from: from.toISOString(), limit: ALL });
}

/** Wraps a write: refreshes everything money-related afterwards and reports failures as a toast. */
export function useAction<TArgs, TResult>(
  action: (args: TArgs) => Promise<TResult>,
  options: { success?: string; onDone?: (result: TResult) => void } = {},
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      client.invalidateQueries();
      if (options.success) toast.success(options.success);
      options.onDone?.(result);
    },
    onError: (error: Error) => {
      toast.error(navigator.onLine ? error.message : 'Du er offline. Prøv igen, når du har forbindelse.');
    },
  });
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
