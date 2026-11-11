import { getStore } from '@netlify/blobs';
import { handle, type KV } from '../../server/handler';

const MAX_ATTEMPTS = 8;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async (req: Request): Promise<Response> => {
  // Consistencia fuerte: lo que escribe un móvil lo lee el siguiente al instante.
  const store = getStore({ name: 'comediarte', consistency: 'strong' });

  const kv: KV = {
    get: (key) => store.get(key, { type: 'json' }),
    list: async (prefix) => (await store.list({ prefix })).blobs.map((blob) => blob.key),

    // Escritura condicionada: solo se guarda si nadie tocó el dato desde que lo leímos;
    // si alguien se adelantó, se vuelve a leer y se repite.
    update: async (key, change) => {
      try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          const found = await store.getWithMetadata(key, { type: 'json' });
          const next = change(found ? found.data : null);
          const result = !found
            ? await store.setJSON(key, next, { onlyIfNew: true })
            : found.etag
              ? await store.setJSON(key, next, { onlyIfMatch: found.etag })
              : await store.setJSON(key, next);
          if (result.modified) return;
          await pause(25 + Math.random() * 75);
        }
        console.warn(`«${key}»: demasiadas escrituras simultáneas, se guarda sin condición`);
      } catch (error) {
        console.error(`«${key}»: la escritura condicionada falló, se guarda sin condición`, error);
      }
      // Último recurso: leer y escribir sin condición. Mejor arriesgar un pisotón que no guardar.
      await store.setJSON(key, change(await store.get(key, { type: 'json' })));
    },
  };

  return handle(req, kv);
};

export const config = { path: '/api/*' };
