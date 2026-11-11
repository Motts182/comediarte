import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { load, save } from './storage';

interface Doc {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

const POLL_MS = 30_000;

/**
 * Colección compartida (eventos, carta). Los cambios se aplican al momento en pantalla,
 * se guardan en el móvil y se reenvían hasta que el servidor los devuelve reflejados,
 * así que una edición hecha sin cobertura no se pierde.
 */
export function useCollection<T extends Doc>(name: 'events' | 'catalog') {
  const cacheKey = `cache:${name}`;
  const pendingKey = `pending:${name}`;

  const [server, setServer] = useState<T[]>(() => load<T[]>(cacheKey, []));
  const [pending, setPendingState] = useState<Record<string, T>>(() => load(pendingKey, {}));
  const [loaded, setLoaded] = useState(false);
  const pendingRef = useRef(pending);
  const running = useRef(false);
  const again = useRef(false);

  const setPending = useCallback(
    (update: (current: Record<string, T>) => Record<string, T>) => {
      const next = update(pendingRef.current);
      pendingRef.current = next;
      save(pendingKey, next);
      setPendingState(next);
    },
    [pendingKey],
  );

  const sync = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        for (const doc of Object.values(pendingRef.current)) {
          await api(`/${name}/${doc.id}`, 'PUT', doc);
        }
        const docs = await api<T[]>(`/${name}`);
        save(cacheKey, docs);
        setServer(docs);
        const stored = new Map(docs.map((doc) => [doc.id, doc]));
        setPending((current) => {
          const next = { ...current };
          for (const [id, doc] of Object.entries(current)) {
            const remote = stored.get(id);
            if (remote && remote.updatedAt >= doc.updatedAt) delete next[id];
          }
          return next;
        });
      } while (again.current);
    } catch {
      /* sin conexión: se reintenta en el siguiente ciclo */
    } finally {
      running.current = false;
      setLoaded(true);
    }
  }, [name, cacheKey, setPending]);

  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    wake();
    const timer = setInterval(wake, POLL_MS);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [sync]);

  const upsert = useCallback(
    (doc: T) => {
      setPending((current) => ({ ...current, [doc.id]: doc }));
      void sync();
    },
    [setPending, sync],
  );

  const docs = useMemo(() => {
    const merged = new Map(server.map((doc) => [doc.id, doc]));
    for (const doc of Object.values(pending)) {
      const remote = merged.get(doc.id);
      if (!remote || doc.updatedAt >= remote.updatedAt) merged.set(doc.id, doc);
    }
    return [...merged.values()].filter((doc) => !doc.deleted);
  }, [server, pending]);

  return { docs, upsert, loaded, pendingCount: Object.keys(pending).length };
}
