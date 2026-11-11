/**
 * Lógica de la API, independiente de dónde se guarden los datos.
 *
 *   GET  /api/events | /api/catalog          → lista de documentos
 *   PUT  /api/events/:id | /api/catalog/:id  → crea o actualiza (gana el updatedAt más alto)
 *   GET  /api/events/:id/sales?etag=         → ventas del evento, un registro por dispositivo
 *   POST /api/events/:id/sales/:device       → añade ventas / anulaciones de un dispositivo
 *
 * Las ventas se guardan en un registro por dispositivo que solo crece (se unen, nunca
 * se sobrescriben), así tres móviles vendiendo a la vez no se pisan entre sí.
 */

export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

interface Doc {
  id: string;
  updatedAt: number;
}

interface DeviceLog {
  device: string;
  sales: { id: string }[];
  deleted: string[];
}

const COLLECTIONS = new Set(['events', 'catalog']);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY = 1_000_000;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Petición demasiado grande');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDoc = (value: unknown): value is Doc =>
  isObject(value) && isId(value.id) && typeof value.updatedAt === 'number';

const isSale = (value: unknown): value is { id: string } => isObject(value) && isId(value.id);

const logTag = (log: DeviceLog) => `${log.device}:${log.sales.length}:${log.deleted.length}`;

async function route(req: Request, kv: KV): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'api') parts.shift();
  const [collection, id, sub, device] = parts;
  const method = req.method.toUpperCase();

  if (COLLECTIONS.has(collection) && parts.length === 1 && method === 'GET') {
    return json((await kv.get<Doc[]>(collection)) ?? []);
  }

  if (COLLECTIONS.has(collection) && parts.length === 2 && method === 'PUT') {
    const doc = await readBody(req);
    if (!isDoc(doc) || doc.id !== id) throw new HttpError(400, 'Documento inválido');
    const docs = (await kv.get<Doc[]>(collection)) ?? [];
    const index = docs.findIndex((item) => item.id === doc.id);
    if (index < 0) docs.push(doc);
    else if (doc.updatedAt >= docs[index].updatedAt) docs[index] = doc;
    await kv.set(collection, docs);
    return json({ ok: true });
  }

  if (collection === 'events' && isId(id) && sub === 'sales') {
    const prefix = `sales/${id}/`;

    if (parts.length === 3 && method === 'GET') {
      const keys = (await kv.list(prefix)).sort();
      const found = await Promise.all(keys.map((key) => kv.get<DeviceLog>(key)));
      const logs = found.filter((log): log is DeviceLog => log !== null);
      const etag = logs.map(logTag).join('|');
      // Los registros solo crecen, así que los tamaños bastan para saber si algo cambió.
      if (etag === url.searchParams.get('etag')) return json({ etag, unchanged: true });
      return json({ etag, logs });
    }

    if (parts.length === 4 && isId(device) && method === 'POST') {
      const body = await readBody(req);
      if (!isObject(body)) throw new HttpError(400, 'Cuerpo inválido');
      const sales = Array.isArray(body.sales) ? body.sales.filter(isSale) : [];
      const deleted = Array.isArray(body.deleted) ? body.deleted.filter(isId) : [];

      const key = prefix + device;
      const log = (await kv.get<DeviceLog>(key)) ?? { device, sales: [], deleted: [] };
      const have = new Set(log.sales.map((sale) => sale.id));
      for (const sale of sales) {
        if (!have.has(sale.id)) {
          have.add(sale.id);
          log.sales.push(sale);
        }
      }
      const dead = new Set(log.deleted);
      for (const saleId of deleted) {
        if (!dead.has(saleId)) {
          dead.add(saleId);
          log.deleted.push(saleId);
        }
      }
      await kv.set(key, log);
      return json({ ok: true });
    }
  }

  throw new HttpError(404, 'No encontrado');
}

export async function handle(req: Request, kv: KV): Promise<Response> {
  try {
    return await route(req, kv);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: 'Error interno' }, 500);
  }
}
