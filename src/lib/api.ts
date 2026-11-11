import { useSyncExternalStore } from 'react';

/** Estado de conexión, deducido de si la última petición a la API salió bien. */
let online = true;
const listeners = new Set<() => void>();

function setOnline(value: boolean) {
  if (value === online) return;
  online = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useOnline = () => useSyncExternalStore(subscribe, () => online);

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as T;
    setOnline(true);
    return data;
  } catch (error) {
    setOnline(false);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
