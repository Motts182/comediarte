import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handle } from './server/handler.ts';
import { fileKV } from './server/fileKV.ts';

/**
 * API local para `npm run dev` / `npm run preview`: misma lógica que la función
 * de Netlify, pero guardando en .data/db.json en vez de en Netlify Blobs.
 */
function localApi(): Plugin {
  const kv = fileKV('.data');
  let queue: Promise<unknown> = Promise.resolve();

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next();
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const request = new Request(`http://local${req.url}`, {
        method: req.method,
        body: body || undefined,
      });
      // En serie: evita que dos peticiones simultáneas se pisen al leer-modificar-escribir.
      queue = queue
        .then(() => handle(request, kv))
        .then(async (response) => {
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        })
        .catch(next);
    });
  };

  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
});
