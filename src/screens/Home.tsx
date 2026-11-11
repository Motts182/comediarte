import { useEffect, useState } from 'react';
import { useData } from '../lib/data';
import type { EventDoc } from '../lib/types';
import { flushStoredLogs } from '../lib/useSales';
import { fmt, longDate, today } from '../lib/util';
import { SyncBadge } from '../ui/SyncBadge';
import { EventForm } from './EventForm';

export function Home() {
  const { events, saveEvent, loaded, pending } = useData();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Por si quedaron ventas sin enviar de un evento que ya no está abierto en pantalla.
    void flushStoredLogs();
    const onOnline = () => void flushStoredLogs();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const now = today();
  const upcoming = events
    .filter((event) => event.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const past = events
    .filter((event) => event.date < now)
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-title">
          <strong className="brand">Comediarte</strong>
          <span>Caja del teatro</span>
        </div>
        <SyncBadge pending={pending} />
      </header>

      <main className="main">
        <button type="button" className="btn btn-primary btn-big" onClick={() => setCreating(true)}>
          + Nuevo evento
        </button>
        <a className="btn btn-ghost" href="#/carta">
          🍺 Carta: bebidas, comida y precios
        </a>

        {events.length === 0 && (
          <p className="empty">
            {loaded
              ? 'Todavía no hay eventos. Crea el primero, por ejemplo «Karaoke», con su fecha y el precio de la entrada.'
              : 'Cargando…'}
          </p>
        )}

        {upcoming.length > 0 && (
          <section className="stack">
            <h2 className="section-title">Hoy y próximos</h2>
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} isToday={event.date === now} />
            ))}
          </section>
        )}

        {past.length > 0 && (
          <section className="stack">
            <h2 className="section-title">Anteriores</h2>
            {past.map((event) => (
              <EventCard key={event.id} event={event} isToday={false} />
            ))}
          </section>
        )}
      </main>

      {creating && (
        <EventForm
          onClose={() => setCreating(false)}
          onSave={(event) => {
            saveEvent(event);
            setCreating(false);
            location.hash = `#/e/${event.id}`;
          }}
        />
      )}
    </div>
  );
}

function EventCard({ event, isToday }: { event: EventDoc; isToday: boolean }) {
  return (
    <a className="event-card" href={`#/e/${event.id}`}>
      <div className="event-info">
        <strong>{event.name}</strong>
        <span>{longDate(event.date)}</span>
        {event.closed && event.totals && (
          <span className="event-totals">
            {event.totals.tickets} entradas · {fmt(event.totals.total)}
          </span>
        )}
      </div>
      {isToday && <span className="chip chip-accent">Hoy</span>}
      {event.closed && <span className="chip">Cerrado</span>}
      <span className="chev" aria-hidden="true">
        ›
      </span>
    </a>
  );
}
