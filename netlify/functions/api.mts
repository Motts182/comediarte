import { getStore } from '@netlify/blobs';
import { handle, type KV } from '../../server/handler';

export default async (req: Request): Promise<Response> => {
  // Consistencia fuerte: lo que escribe un móvil lo lee el siguiente al instante.
  const store = getStore({ name: 'comediarte', consistency: 'strong' });
  const kv: KV = {
    get: (key) => store.get(key, { type: 'json' }),
    set: async (key, value) => {
      await store.setJSON(key, value);
    },
    list: async (prefix) => (await store.list({ prefix })).blobs.map((blob) => blob.key),
  };
  return handle(req, kv);
};

export const config = { path: '/api/*' };
