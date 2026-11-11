import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { DEVICE_ID, keys, load, remove, save } from './storage';
import type { DeviceLog, Sale } from './types';

/**
 * Ventas de un evento.
 *
 * Cada móvil tiene su propio registro: lo guarda en local al instante y envía al servidor
 * solo lo que falta. Las anulaciones son marcas ("esta venta no cuenta") en vez de borrados.
 * Como los registros solo crecen y el servidor los une, da igual el orden o que se repita
 * un envío: los tres móviles acaban viendo lo mismo y sin cobertura no se pierde nada.
 */

interface OwnLog {
  sales: Sale[];
  deleted: string[];
  /** Ids de ventas que el servidor todavía no ha confirmado. */
  unsent: string[];
  /** Ids de anulaciones que el servidor todavía no ha confirmado. */
  unsentDeleted: string[];
}

interface SalesResponse {
  etag: string;
  unchanged?: boolean;
  logs?: DeviceLog[];
}

const EMPTY: OwnLog = { sales: [], deleted: [], unsent: [], unsentDeleted: [] };
const POLL_MS = 5_000;
const KEEP_EVENTS = 8;

const hasUnsent = (log: OwnLog) => log.unsent.length > 0 || log.unsentDeleted.length > 0;

function unsentBody(log: OwnLog) {
  const ids = new Set(log.unsent);
  return { sales: log.sales.filter((sale) => ids.has(sale.id)), deleted: log.unsentDeleted };
}

function markSent(log: OwnLog, sent: { sales: Sale[]; deleted: string[] }): OwnLog {
  const sales = new Set(sent.sales.map((sale) => sale.id));
  const deleted = new Set(sent.deleted);
  return {
    ...log,
    unsent: log.unsent.filter((id) => !sales.has(id)),
    unsentDeleted: log.unsentDeleted.filter((id) => !deleted.has(id)),
  };
}

/**
 * Compara el registro local con lo que el servidor tiene de este mismo móvil:
 * trae lo que falte aquí (otra pestaña, datos locales borrados) y vuelve a marcar
 * como pendiente lo que el servidor no tenga.
 */
function reconcile(own: OwnLog, remote?: DeviceLog): OwnLog {
  const remoteSales = remote?.sales ?? [];
  const remoteDeleted = remote?.deleted ?? [];

  const localIds = new Set(own.sales.map((sale) => sale.id));
  const remoteIds = new Set(remoteSales.map((sale) => sale.id));
  const newSales = remoteSales.filter((sale) => !localIds.has(sale.id));
  const unsent = new Set(own.unsent);
  for (const sale of own.sales) if (!remoteIds.has(sale.id)) unsent.add(sale.id);

  const localDead = new Set(own.deleted);
  const remoteDead = new Set(remoteDeleted);
  const newDeleted = remoteDeleted.filter((id) => !localDead.has(id));
  const unsentDeleted = new Set(own.unsentDeleted);
  for (const id of own.deleted) if (!remoteDead.has(id)) unsentDeleted.add(id);

  const unchanged =
    newSales.length === 0 &&
    newDeleted.length === 0 &&
    unsent.size === own.unsent.length &&
    unsentDeleted.size === own.unsentDeleted.length;
  if (unchanged) return own;

  return {
    sales: [...own.sales, ...newSales],
    deleted: [...own.deleted, ...newDeleted],
    unsent: [...unsent],
    unsentDeleted: [...unsentDeleted],
  };
}

/** Anota que se ha abierto el evento y libera la copia local de los que hace tiempo que no se abren. */
function touchEvent(eventId: string) {
  const seen = load<Record<string, number>>('seen', {});
  seen[eventId] = Date.now();
  const stale = Object.keys(seen)
    .sort((a, b) => seen[b] - seen[a])
    .slice(KEEP_EVENTS);
  for (const id of stale) {
    if (hasUnsent(load(`log:${id}`, EMPTY))) continue;
    remove(`log:${id}`);
    remove(`others:${id}`);
    delete seen[id];
  }
  save('seen', seen);
}

/** Envía ventas que se quedaron sin mandar en eventos que ahora no están abiertos en pantalla. */
export async function flushStoredLogs(): Promise<void> {
  for (const key of keys('log:')) {
    const log = load<OwnLog>(key, EMPTY);
    if (!hasUnsent(log)) continue;
    const body = unsentBody(log);
    try {
      await api(`/events/${key.slice('log:'.length)}/sales/${DEVICE_ID}`, 'POST', body);
    } catch {
      return;
    }
    save(key, markSent(load<OwnLog>(key, log), body));
  }
}

export function useSales(eventId: string) {
  const ownKey = `log:${eventId}`;
  const othersKey = `others:${eventId}`;

  const [own, setOwnState] = useState<OwnLog>(() => load(ownKey, EMPTY));
  const [others, setOthers] = useState<DeviceLog[]>(() => load<DeviceLog[]>(othersKey, []));
  const [synced, setSynced] = useState(false);
  const ownRef = useRef(own);
  const etag = useRef('-');
  const running = useRef(false);
  const again = useRef(false);

  const setOwn = useCallback(
    (update: (current: OwnLog) => OwnLog) => {
      const next = update(ownRef.current);
      if (next === ownRef.current) return;
      ownRef.current = next;
      save(ownKey, next);
      setOwnState(next);
    },
    [ownKey],
  );

  const sync = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      // Tope de vueltas: si el servidor tardase en reflejar un envío, no queremos un bucle sin pausa.
      for (let round = 0; round < 3; round++) {
        again.current = false;

        if (hasUnsent(ownRef.current)) {
          const body = unsentBody(ownRef.current);
          await api(`/events/${eventId}/sales/${DEVICE_ID}`, 'POST', body);
          setOwn((current) => markSent(current, body));
        }

        const response = await api<SalesResponse>(
          `/events/${eventId}/sales?etag=${encodeURIComponent(etag.current)}`,
        );
        if (response.logs) {
          etag.current = response.etag;
          const mine = response.logs.find((log) => log.device === DEVICE_ID);
          const rest = response.logs.filter((log) => log.device !== DEVICE_ID);
          setOwn((current) => reconcile(current, mine));
          save(othersKey, rest);
          setOthers(rest);
        }
        setSynced(true);

        if (!again.current && !hasUnsent(ownRef.current)) break;
      }
    } catch {
      /* sin conexión: se reintenta en el siguiente ciclo */
    } finally {
      running.current = false;
    }
  }, [eventId, othersKey, setOwn]);

  useEffect(() => {
    touchEvent(eventId);
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
  }, [eventId, sync]);

  const add = useCallback(
    (sale: Sale) => {
      setOwn((current) => ({
        ...current,
        sales: [...current.sales, sale],
        unsent: [...current.unsent, sale.id],
      }));
      void sync();
    },
    [setOwn, sync],
  );

  const cancel = useCallback(
    (saleId: string) => {
      setOwn((current) =>
        current.deleted.includes(saleId)
          ? current
          : {
              ...current,
              deleted: [...current.deleted, saleId],
              unsentDeleted: [...current.unsentDeleted, saleId],
            },
      );
      void sync();
    },
    [setOwn, sync],
  );

  /** Todas las ventas vigentes del evento (las de los tres móviles), de la más reciente a la más antigua. */
  const sales = useMemo(() => {
    const dead = new Set(own.deleted);
    for (const log of others) for (const id of log.deleted) dead.add(id);
    const merged = new Map<string, Sale>();
    for (const log of others) for (const sale of log.sales) merged.set(sale.id, sale);
    for (const sale of own.sales) merged.set(sale.id, sale);
    return [...merged.values()].filter((sale) => !dead.has(sale.id)).sort((a, b) => b.at - a.at);
  }, [own, others]);

  return {
    sales,
    add,
    cancel,
    /** Operaciones de este móvil que aún no han llegado al servidor. */
    unsent: own.unsent.length + own.unsentDeleted.length,
    /** true cuando ya hemos recibido del servidor las ventas de los demás al menos una vez. */
    synced,
  };
}
