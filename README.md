# Comediarte · Caja

Web móvil para llevar la caja del teatro entre tres personas a la vez: una cobra entradas,
otra bebidas y otra comida. Cada venta queda registrada dentro de su evento
(«Karaoke del 20/11/2026») con su forma de pago, efectivo o Bizum.

## Cómo se usa

1. **Carta**: se cargan una vez las bebidas y comidas con su precio.
2. **Nuevo evento**: nombre, fecha y precio de la entrada (admite varios tipos: General, Reducida…).
3. Cada persona abre el evento en su móvil y se queda en su pestaña: **Entradas**, **Bebidas** o **Comida**.
   Toca los productos, y luego **Efectivo** o **Bizum**. El móvil recuerda la pestaña.
4. **Resumen** muestra en vivo los totales de los tres puestos. **Cerrar evento** bloquea las
   ventas y enseña el resultado final; se puede compartir como texto o descargar en CSV.

No hay inicio de sesión: cualquiera que tenga la dirección de la web puede ver y anotar ventas.

## Probar en local

```bash
npm install
npm run dev
```

Abre la dirección «Network» que imprime Vite desde varios móviles conectados a la misma wifi
para probar el uso simultáneo. En local los datos se guardan en `.data/db.json`.

## Publicar

Está preparado para **Netlify**: al conectar el repositorio, `netlify.toml` ya indica el comando
de build, la carpeta a publicar y la función. No hay que configurar base de datos ni variables.

En Vercel se publicaría la web, pero no los datos compartidos: el almacenamiento usa Netlify Blobs.

## Cómo se guardan los datos

Una web sin nada detrás solo puede guardar en el propio móvil, y entonces cada uno vería solo
lo suyo. Para que los tres compartan los datos hay una única función (`netlify/functions/api.mts`)
que lee y escribe JSON en Netlify Blobs, el almacén que viene incluido con el sitio.

- `server/handler.ts`: toda la lógica de la API. La usan igual la función de Netlify y el
  servidor de desarrollo de Vite.
- Cada móvil guarda sus ventas primero en local y las envía después. Sin cobertura se sigue
  vendiendo; el punto de arriba a la derecha pasa a rojo y lo pendiente se envía al volver la señal.
- Las ventas se almacenan en un registro por móvil que solo crece, y anular una venta es añadir
  una marca, no borrar. Así tres personas escribiendo a la vez no se pisan.
- Los móviles consultan las novedades cada 5 segundos (`POLL_MS` en `src/lib/useSales.ts`).

## Estructura

```
src/lib/       tipos, sincronización (useSales, useCollection), totales y exportación
src/screens/   Home, EventView (puestos de venta y resumen), Catalog (carta)
src/ui/        diálogo, aviso y estado de sincronización
server/        lógica de la API y almacén en fichero para desarrollo
netlify/       función que conecta la API con Netlify Blobs
```
