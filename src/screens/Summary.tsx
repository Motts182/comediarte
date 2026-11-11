import type { KindSummary, Summary } from '../lib/summary';
import { KIND_META, KINDS, type EventDoc, type Kind } from '../lib/types';
import { dateTimeOf, fmt } from '../lib/util';

function unitsLabel(kind: Kind, units: number): string {
  if (kind === 'ticket') return units === 1 ? '1 entrada' : `${units} entradas`;
  return units === 1 ? '1 unidad' : `${units} unidades`;
}

function KindCard({ kind, part }: { kind: Kind; part: KindSummary }) {
  const meta = KIND_META[kind];
  return (
    <section className="card">
      <div className="kind-head">
        <span className="kind-icon" aria-hidden="true">
          {meta.icon}
        </span>
        <div className="kind-title">
          <strong>{meta.label}</strong>
          <span>{unitsLabel(kind, part.units)}</span>
        </div>
        <strong className="kind-total">{fmt(part.total)}</strong>
      </div>

      <div className="split">
        <div className="split-cell">
          <span className="pill pill-cash">Efectivo</span>
          <strong>{fmt(part.cash.amount)}</strong>
          <small>{unitsLabel(kind, part.cash.units)}</small>
        </div>
        <div className="split-cell">
          <span className="pill pill-bizum">Bizum</span>
          <strong>{fmt(part.bizum.amount)}</strong>
          <small>{unitsLabel(kind, part.bizum.units)}</small>
        </div>
      </div>

      {part.items.length > 0 && (
        <ul className="item-list">
          {part.items.map((item) => (
            <li key={item.key}>
              <span>
                {item.qty}× {item.name} <small>({fmt(item.price)})</small>
              </span>
              <span>{fmt(item.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Totales del evento: recaudación global y desglose por entradas, bebidas y comida. */
export function Totals({ summary }: { summary: Summary }) {
  return (
    <div className="stack">
      <section className="card card-total">
        <span className="total-label">Total recaudado</span>
        <strong className="total-amount">{fmt(summary.total)}</strong>
        <div className="split">
          <div className="split-cell">
            <span className="pill pill-cash">Efectivo</span>
            <strong>{fmt(summary.cash)}</strong>
          </div>
          <div className="split-cell">
            <span className="pill pill-bizum">Bizum</span>
            <strong>{fmt(summary.bizum)}</strong>
          </div>
        </div>
      </section>
      {KINDS.map((kind) => (
        <KindCard key={kind} kind={kind} part={summary[kind]} />
      ))}
    </div>
  );
}

interface PanelProps {
  event: EventDoc;
  summary: Summary;
  hasSales: boolean;
  onAskClose: () => void;
  onAskReopen: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onShare: () => void;
  onCsv: () => void;
}

export function SummaryPanel({
  event,
  summary,
  hasSales,
  onAskClose,
  onAskReopen,
  onEdit,
  onAskDelete,
  onShare,
  onCsv,
}: PanelProps) {
  return (
    <>
      {event.closed && (
        <p className="notice">
          🔒 Evento cerrado{event.closedAt ? ` el ${dateTimeOf(event.closedAt)}` : ''}. Estos son
          los resultados finales.
        </p>
      )}

      <Totals summary={summary} />

      <div className="stack">
        {!event.closed && (
          <button type="button" className="btn btn-primary btn-big" onClick={onAskClose}>
            Cerrar evento
          </button>
        )}
        <div className="pair">
          <button type="button" className="btn" onClick={onShare}>
            Compartir
          </button>
          <button type="button" className="btn" onClick={onCsv} disabled={!hasSales}>
            Descargar CSV
          </button>
        </div>
        {event.closed ? (
          <button type="button" className="btn btn-ghost" onClick={onAskReopen}>
            Reabrir evento
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={onEdit}>
            Editar evento y precio de entradas
          </button>
        )}
        <button type="button" className="link link-danger" onClick={onAskDelete}>
          Eliminar evento
        </button>
      </div>
    </>
  );
}
