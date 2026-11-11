import { useEffect, useMemo, useState } from 'react';
import { DataContext, type Data } from './lib/data';
import type { EventDoc, Product } from './lib/types';
import { useCollection } from './lib/useCollection';
import { Catalog } from './screens/Catalog';
import { EventView } from './screens/EventView';
import { Home } from './screens/Home';
import { dismissToast, ToastHost } from './ui/toast';

/** Rutas por hash (#/, #/carta, #/e/<id>): funcionan en cualquier hosting estático sin configurar nada. */
function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => {
      // Un aviso de la pantalla anterior ("Cobrado… Deshacer") no debe tapar la nueva.
      dismissToast();
      setHash(location.hash);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const events = useCollection<EventDoc>('events');
  const catalog = useCollection<Product>('catalog');

  const data = useMemo<Data>(
    () => ({
      events: events.docs,
      products: catalog.docs,
      saveEvent: events.upsert,
      saveProduct: catalog.upsert,
      loaded: events.loaded,
      pending: events.pendingCount + catalog.pendingCount,
    }),
    [
      events.docs,
      events.upsert,
      events.loaded,
      events.pendingCount,
      catalog.docs,
      catalog.upsert,
      catalog.pendingCount,
    ],
  );

  const [section, id] = hash.replace(/^#\/?/, '').split('/');
  let screen;
  if (section === 'e' && id) screen = <EventView key={id} id={id} />;
  else if (section === 'carta') screen = <Catalog />;
  else screen = <Home />;

  return (
    <DataContext.Provider value={data}>
      <div className="app">{screen}</div>
      <ToastHost />
    </DataContext.Provider>
  );
}
