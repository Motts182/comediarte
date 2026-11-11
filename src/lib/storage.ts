import { uid } from './util';

/** Envoltorio de localStorage: nunca lanza (modo privado, almacenamiento lleno…). */
const PREFIX = 'comediarte:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: la app sigue funcionando en memoria */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* nada que hacer */
  }
}

export function keys(prefix: string): string[] {
  const found: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX + prefix)) found.push(key.slice(PREFIX.length));
    }
  } catch {
    /* nada que hacer */
  }
  return found;
}

/** Identificador estable de este móvil/navegador: cada uno escribe en su propio registro de ventas. */
export const DEVICE_ID: string = (() => {
  let id = load('device', '');
  if (!id) {
    id = uid();
    save('device', id);
  }
  return id;
})();
