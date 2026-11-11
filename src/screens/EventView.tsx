import { useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data';
import { load, save } from '../lib/storage';
import { downloadFile, reportText, salesCsv, summarize } from '../lib/summary';
import {
  KIND_META,
  PAY_LABEL,
  type Kind,
  type Payment,
  type ProductKind,
  type Sale,
  type SaleItem,
} from '../lib/types';
import { useSales } from '../lib/useSales';
import { byName, eventTitle, fmt, longDate, stamp, timeOf, uid } from '../lib/util';
import { Confirm, Modal } from '../ui/Modal';
import { SyncBadge } from '../ui/SyncBadge';
import { toast } from '../ui/toast';
import { ProductForm } from './Catalog';
import { EventForm } from './EventForm';
import { SellPanel } from './SellPanel';
import { SummaryPanel, Totals } from './Summary';

type Tab = Kind | 'summary';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'ticket', ...KIND_META.ticket },
  { id: 'drink', ...KIND_META.drink },
  { id: 'food', ...KIND_META.food },
  { id: 'summary', icon: '📊', label: 'Resumen' },
];

type Dialog =
  | { type: 'cancel'; sale: Sale }
  | { type: 'close' }
  | { type: 'closed' }
  | { type: 'reopen' }
  | { type: 'edit' }
  | { type: 'delete' }
  | { type: 'product'; kind: ProductKind };

type Carts = Record<Kind, Record<string, number>>;

async function share(text: string) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      toast('Resumen copiado al portapapeles');
    }
  } catch (error) {
    // Cerrar el menú de compartir sin elegir nada no es un error.
    if ((error as Error)?.name !== 'AbortError') toast('No se pudo compartir el resumen');
  }
}

export function EventView({ id }: { id: string }) {
  const { events, products, saveEvent, saveProduct, loaded, pending } = useData();
  const event = events.find((item) => item.id === id);
  const { sales, add, cancel, unsent, synced } = useSales(id);
  const [picked, setPicked] = useState<Tab | null>(null);
  const [carts, setCarts] = useState<Carts>({ ticket: {}, drink: {}, food: {} });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const summary = useMemo(() => summarize(sales), [sales]);

  // Si tras cerrar llega alguna venta rezagada (un móvil sin cobertura), actualiza la foto
  // de totales que se enseña en el listado de eventos.
  const ticketUnits = summary.ticket.units;
  const grandTotal = summary.total;
  useEffect(() => {
    if (!event?.closed || !synced || unsent > 0) return;
    if (event.totals?.tickets === ticketUnits && event.totals.total === grandTotal) return;
    saveEvent({
      ...event,
      totals: { tickets: ticketUnits, total: grandTotal },
      updatedAt: stamp(event),
    });
  }, [event, synced, unsent, ticketUnits, grandTotal, saveEvent]);

  if (!event) {
    return (
      <div className="screen">
        <header className="topbar">
          <a className="icon-btn" href="#/" aria-label="Volver a eventos">
            ‹
          </a>
          <div className="topbar-title">
            <strong>Evento</strong>
          </div>
        </header>
        <main className="main">
          <p className="empty">{loaded ? 'Este evento ya no existe.' : 'Cargando…'}</p>
        </main>
      </div>
    );
  }

  // Cada persona vuelve siempre a su puesto: se recuerda la última pestaña de venta usada en este móvil.
  const tab: Tab = picked ?? (event.closed ? 'summary' : load<Tab>('tab', 'ticket'));
  const pickTab = (next: Tab) => {
    setPicked(next);
    if (next !== 'summary') save('tab', next);
  };

  const sell = (kind: Kind, items: SaleItem[], payment: Payment) => {
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const sale: Sale = { id: uid(), kind, items, total, payment, at: Date.now() };
    add(sale);
    navigator.vibrate?.(20);
    toast(`Cobrado ${fmt(total)} · ${PAY_LABEL[payment]}`, {
      label: 'Deshacer',
      run: () => cancel(sale.id),
    });
  };

  const closeEvent = () => {
    saveEvent({
      ...event,
      closed: true,
      closedAt: Date.now(),
      totals: { tickets: summary.ticket.units, total: summary.total },
      updatedAt: stamp(event),
    });
    setPicked('summary');
    setDialog({ type: 'closed' });
  };

  const reopenEvent = () => {
    saveEvent({
      ...event,
      closed: false,
      closedAt: undefined,
      totals: undefined,
      updatedAt: stamp(event),
    });
    setDialog(null);
  };

  const deleteEvent = () => {
    saveEvent({ ...event, deleted: true, updatedAt: stamp(event) });
    location.hash = '#/';
  };

  const shareReport = () => void share(reportText(event, summary));

  const downloadCsv = () =>
    downloadFile(
      `${event.date} ${event.name}.csv`.replace(/[\\/:*?"<>|]/g, '-'),
      salesCsv(sales),
      'text/csv;charset=utf-8',
    );

  const sellables =
    tab === 'summary'
      ? []
      : tab === 'ticket'
        ? event.tickets
        : products.filter((product) => product.kind === tab && product.active).sort(byName);

  return (
    <div className="screen">
      <header className="topbar">
        <a className="icon-btn" href="#/" aria-label="Volver a eventos">
          ‹
        </a>
        <div className="topbar-title">
          <strong>{event.name}</strong>
          <span>
            {longDate(event.date)}
            {event.closed ? ' · cerrado' : ''}
          </span>
        </div>
        <SyncBadge pending={pending + unsent} />
      </header>

      {tab === 'summary' ? (
        <main className="main">
          <SummaryPanel
            event={event}
            summary={summary}
            hasSales={sales.length > 0}
            onAskClose={() => setDialog({ type: 'close' })}
            onAskReopen={() => setDialog({ type: 'reopen' })}
            onEdit={() => setDialog({ type: 'edit' })}
            onAskDelete={() => setDialog({ type: 'delete' })}
            onShare={shareReport}
            onCsv={downloadCsv}
          />
        </main>
      ) : (
        <SellPanel
          key={tab}
          kind={tab}
          items={sellables}
          sales={sales.filter((sale) => sale.kind === tab)}
          closed={event.closed}
          cart={carts[tab]}
          setCart={(cart) => setCarts({ ...carts, [tab]: cart })}
          onSell={(items, payment) => sell(tab, items, payment)}
          onCancelSale={(sale) => setDialog({ type: 'cancel', sale })}
          onAddProduct={tab === 'ticket' ? undefined : () => setDialog({ type: 'product', kind: tab })}
        />
      )}

      <nav className="tabbar" aria-label="Secciones del evento">
        {TABS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`tab${tab === item.id ? ' is-active' : ''}`}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => pickTab(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {dialog?.type === 'cancel' && (
        <Confirm
          title="¿Anular esta venta?"
          text={`${timeOf(dialog.sale.at)} · ${dialog.sale.items
            .map((item) => `${item.qty}× ${item.name}`)
            .join(', ')} · ${fmt(dialog.sale.total)} (${PAY_LABEL[dialog.sale.payment]}). Dejará de contar en los totales.`}
          label="Anular venta"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            cancel(dialog.sale.id);
            setDialog(null);
            toast('Venta anulada');
          }}
        />
      )}

      {dialog?.type === 'close' && (
        <Confirm
          title="¿Cerrar el evento?"
          text={
            unsent > 0
              ? 'Este móvil todavía tiene ventas sin enviar; se sumarán en cuanto vuelva la conexión. Al cerrar, nadie podrá registrar más ventas (se puede reabrir).'
              : 'Verás los resultados finales y nadie podrá registrar más ventas. Si hace falta, se puede reabrir.'
          }
          label="Cerrar evento"
          onCancel={() => setDialog(null)}
          onConfirm={closeEvent}
        />
      )}

      {dialog?.type === 'closed' && (
        <Modal title={`Cierre · ${eventTitle(event)}`} onClose={() => setDialog(null)}>
          <Totals summary={summary} />
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={shareReport}>
              Compartir
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDialog(null)}>
              Listo
            </button>
          </div>
        </Modal>
      )}

      {dialog?.type === 'reopen' && (
        <Confirm
          title="¿Reabrir el evento?"
          text="Se podrán volver a registrar y anular ventas."
          label="Reabrir"
          onCancel={() => setDialog(null)}
          onConfirm={reopenEvent}
        />
      )}

      {dialog?.type === 'delete' && (
        <Confirm
          title="¿Eliminar el evento?"
          text={`«${eventTitle(event)}» desaparecerá del listado en los tres móviles, con todas sus ventas.`}
          label="Eliminar"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={deleteEvent}
        />
      )}

      {dialog?.type === 'edit' && (
        <EventForm
          event={event}
          onClose={() => setDialog(null)}
          onSave={(updated) => {
            saveEvent(updated);
            setDialog(null);
          }}
        />
      )}

      {dialog?.type === 'product' && (
        <ProductForm kind={dialog.kind} onSave={saveProduct} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
