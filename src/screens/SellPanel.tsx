import { useMemo, useState } from 'react';
import { summarizeKind } from '../lib/summary';
import { KIND_META, PAY_LABEL, type Kind, type Payment, type Sale, type SaleItem } from '../lib/types';
import { fmt, timeOf } from '../lib/util';

interface Sellable {
  id: string;
  name: string;
  price: number;
}

interface Props {
  kind: Kind;
  items: Sellable[];
  /** Ventas vigentes de este puesto (entradas, bebidas o comida), la más reciente primero. */
  sales: Sale[];
  closed: boolean;
  cart: Record<string, number>;
  setCart: (cart: Record<string, number>) => void;
  onSell: (items: SaleItem[], payment: Payment) => void;
  onCancelSale: (sale: Sale) => void;
  /** Alta rápida de producto desde el propio puesto (no aplica a entradas). */
  onAddProduct?: () => void;
}

const PAGE = 15;

export function SellPanel({
  kind,
  items,
  sales,
  closed,
  cart,
  setCart,
  onSell,
  onCancelSale,
  onAddProduct,
}: Props) {
  const [limit, setLimit] = useState(PAGE);
  const meta = KIND_META[kind];
  const stats = useMemo(() => summarizeKind(sales), [sales]);

  const lines = items
    .filter((item) => cart[item.id] > 0)
    .map(({ id, name, price }) => ({ id, name, price, qty: cart[id] }));
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  const change = (id: string, delta: number) => {
    const qty = Math.max(0, (cart[id] ?? 0) + delta);
    const next = { ...cart };
    if (qty > 0) next[id] = qty;
    else delete next[id];
    setCart(next);
  };

  const pay = (payment: Payment) => {
    if (lines.length === 0) return;
    onSell(lines, payment);
    setCart({});
  };

  return (
    <>
      <main className="main">
        <div className="stats" aria-label={`Resumen de ${meta.label.toLowerCase()}`}>
          <div>
            <strong>{stats.units}</strong>
            <span>{meta.unit}</span>
          </div>
          <div>
            <strong>{fmt(stats.total)}</strong>
            <span>total</span>
          </div>
          <div>
            <strong>{fmt(stats.cash.amount)}</strong>
            <span>efectivo</span>
          </div>
          <div>
            <strong>{fmt(stats.bizum.amount)}</strong>
            <span>bizum</span>
          </div>
        </div>

        {closed ? (
          <p className="notice">🔒 Evento cerrado: no se pueden registrar más ventas.</p>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`tile${cart[item.id] ? ' in-cart' : ''}`}
                onClick={() => change(item.id, 1)}
              >
                <span className="tile-name">{item.name}</span>
                <span className="tile-price">{fmt(item.price)}</span>
                {cart[item.id] > 0 && <span className="badge">{cart[item.id]}</span>}
              </button>
            ))}
            {onAddProduct && (
              <button type="button" className="tile tile-add" onClick={onAddProduct}>
                + Añadir {kind === 'drink' ? 'bebida' : 'comida'}
              </button>
            )}
          </div>
        )}

        {sales.length > 0 && (
          <section className="stack">
            <h2 className="section-title">Últimas ventas</h2>
            {sales.slice(0, limit).map((sale) => (
              <div className="sale-row" key={sale.id}>
                <span className="sale-time">{timeOf(sale.at)}</span>
                <span className="sale-desc">
                  {sale.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                </span>
                <span className={`pill pill-${sale.payment}`}>{PAY_LABEL[sale.payment]}</span>
                <strong className="sale-total">{fmt(sale.total)}</strong>
                {!closed && (
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => onCancelSale(sale)}
                    aria-label={`Anular venta de las ${timeOf(sale.at)}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {sales.length > limit && (
              <button type="button" className="btn btn-ghost" onClick={() => setLimit(limit + 30)}>
                Ver más ({sales.length - limit})
              </button>
            )}
          </section>
        )}
      </main>

      {!closed && (
        <div className="paybar">
          {lines.length === 0 ? (
            <p className="paybar-hint">
              {kind === 'ticket'
                ? 'Toca una entrada para añadirla a la cuenta'
                : 'Toca un producto para añadirlo a la cuenta'}
            </p>
          ) : (
            <>
              <div className="cart">
                {lines.map((line) => (
                  <div className="cart-line" key={line.id}>
                    <span className="cart-name">{line.name}</span>
                    <div className="stepper">
                      <button
                        type="button"
                        onClick={() => change(line.id, -1)}
                        aria-label={`Quitar uno de ${line.name}`}
                      >
                        −
                      </button>
                      <b>{line.qty}</b>
                      <button
                        type="button"
                        onClick={() => change(line.id, 1)}
                        aria-label={`Añadir uno de ${line.name}`}
                      >
                        +
                      </button>
                    </div>
                    <span className="cart-amount">{fmt(line.price * line.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="paybar-total">
                <button type="button" className="link" onClick={() => setCart({})}>
                  Vaciar
                </button>
                <span>Total</span>
                <strong>{fmt(total)}</strong>
              </div>
            </>
          )}
          <div className="pay-buttons">
            <button
              type="button"
              className="btn btn-cash btn-big"
              disabled={lines.length === 0}
              onClick={() => pay('cash')}
            >
              💶 Efectivo
            </button>
            <button
              type="button"
              className="btn btn-bizum btn-big"
              disabled={lines.length === 0}
              onClick={() => pay('bizum')}
            >
              📱 Bizum
            </button>
          </div>
        </div>
      )}
    </>
  );
}
