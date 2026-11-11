import { useState, type FormEvent } from 'react';
import { load, save } from '../lib/storage';
import type { EventDoc, TicketType } from '../lib/types';
import { moneyInput, parseMoney, stamp, today, uid } from '../lib/util';
import { Modal } from '../ui/Modal';

interface Row {
  id: string;
  name: string;
  price: string;
}

interface Props {
  event?: EventDoc;
  onSave: (event: EventDoc) => void;
  onClose: () => void;
}

export function EventForm({ event, onSave, onClose }: Props) {
  const [name, setName] = useState(event?.name ?? '');
  const [date, setDate] = useState(event?.date ?? today());
  const [rows, setRows] = useState<Row[]>(() =>
    event
      ? event.tickets.map((ticket) => ({ ...ticket, price: moneyInput(ticket.price) }))
      : [{ id: uid(), name: 'General', price: load('lastTicketPrice', '') }],
  );
  const [error, setError] = useState('');

  const patchRow = (id: string, patch: Partial<Row>) =>
    setRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const submit = (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!name.trim()) return setError('Ponle un nombre al evento.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Elige la fecha del evento.');
    const tickets: TicketType[] = [];
    for (const row of rows) {
      const price = parseMoney(row.price);
      if (!row.name.trim() || price === null) {
        return setError('Cada tipo de entrada necesita nombre y precio (usa 0 si es gratis).');
      }
      tickets.push({ id: row.id, name: row.name.trim(), price });
    }
    save('lastTicketPrice', rows[0].price);
    onSave({
      id: event?.id ?? uid(),
      name: name.trim(),
      date,
      tickets,
      closed: event?.closed ?? false,
      closedAt: event?.closedAt,
      totals: event?.totals,
      updatedAt: stamp(event),
    });
  };

  return (
    <Modal title={event ? 'Editar evento' : 'Nuevo evento'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Nombre</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Karaoke"
            autoFocus={!event}
            autoComplete="off"
            enterKeyHint="next"
          />
        </label>

        <label className="field">
          <span>Fecha</span>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div className="field">
          <span>Entradas</span>
          {rows.map((row) => (
            <div className="ticket-row" key={row.id}>
              <input
                className="input"
                value={row.name}
                onChange={(e) => patchRow(row.id, { name: e.target.value })}
                placeholder="Tipo (General, Reducida…)"
                aria-label="Tipo de entrada"
                autoComplete="off"
              />
              <div className="money">
                <input
                  className="input"
                  inputMode="decimal"
                  value={row.price}
                  onChange={(e) => patchRow(row.id, { price: e.target.value })}
                  placeholder="0,00"
                  aria-label={`Precio de ${row.name || 'la entrada'}`}
                  autoComplete="off"
                />
                <span>€</span>
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => setRows(rows.filter((item) => item.id !== row.id))}
                  aria-label={`Quitar ${row.name || 'tipo de entrada'}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="link"
            onClick={() => setRows([...rows, { id: uid(), name: '', price: '' }])}
          >
            + Añadir otro tipo de entrada
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {event ? 'Guardar' : 'Crear evento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
