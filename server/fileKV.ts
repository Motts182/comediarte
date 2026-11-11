import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KV } from './handler.ts';

/** Almacén clave-valor en un único JSON. Solo para desarrollo local. */
export function fileKV(dir: string): KV {
  const file = join(dir, 'db.json');
  let data: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      data = {};
    }
  }
  const persist = () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(data));
  };
  return {
    async get<T>(key: string) {
      return key in data ? (structuredClone(data[key]) as T) : null;
    },
    async set(key, value) {
      data[key] = structuredClone(value);
      persist();
    },
    async list(prefix) {
      return Object.keys(data).filter((key) => key.startsWith(prefix));
    },
  };
}
