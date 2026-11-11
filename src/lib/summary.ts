import { KIND_META, KINDS, PAY_LABEL, type EventDoc, type Kind, type Sale } from './types';
import { eventTitle, fmt, shortDate, timeOf } from './util';

export interface PaySplit {
  amount: number;
  units: number;
}

export interface ItemLine {
  key: string;
  name: string;
  price: number;
  qty: number;
  total: number;
}

export interface KindSummary {
  units: number;
  total: number;
  cash: PaySplit;
  bizum: PaySplit;
  items: ItemLine[];
}

export interface Summary {
  ticket: KindSummary;
  drink: KindSummary;
  food: KindSummary;
  total: number;
  cash: number;
  bizum: number;
}

export function summarizeKind(sales: Sale[]): KindSummary {
  const summary: KindSummary = {
    units: 0,
    total: 0,
    cash: { amount: 0, units: 0 },
    bizum: { amount: 0, units: 0 },
    items: [],
  };
  const lines = new Map<string, ItemLine>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const amount = item.price * item.qty;
      summary.units += item.qty;
      summary.total += amount;
      summary[sale.payment].units += item.qty;
      summary[sale.payment].amount += amount;
      // Mismo producto vendido a dos precios distintos (se cambió la carta) → dos líneas.
      const key = `${item.id}:${item.price}`;
      const line = lines.get(key) ?? { key, name: item.name, price: item.price, qty: 0, total: 0 };
      line.qty += item.qty;
      line.total += amount;
      lines.set(key, line);
    }
  }
  summary.items = [...lines.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return summary;
}

export function summarize(sales: Sale[]): Summary {
  const of = (kind: Kind) => summarizeKind(sales.filter((sale) => sale.kind === kind));
  const ticket = of('ticket');
  const drink = of('drink');
  const food = of('food');
  return {
    ticket,
    drink,
    food,
    total: ticket.total + drink.total + food.total,
    cash: ticket.cash.amount + drink.cash.amount + food.cash.amount,
    bizum: ticket.bizum.amount + drink.bizum.amount + food.bizum.amount,
  };
}

/** Resumen en texto plano para compartir por WhatsApp, correo, etc. */
export function reportText(event: EventDoc, summary: Summary): string {
  const lines: string[] = [`${eventTitle(event)}${event.closed ? ' · Cierre' : ''}`, ''];
  for (const kind of KINDS) {
    const meta = KIND_META[kind];
    const part = summary[kind];
    lines.push(`${meta.icon} ${meta.label}: ${part.units} · ${fmt(part.total)}`);
    lines.push(`   Efectivo: ${part.cash.units} · ${fmt(part.cash.amount)}`);
    lines.push(`   Bizum: ${part.bizum.units} · ${fmt(part.bizum.amount)}`);
    if (kind !== 'ticket' || part.items.length > 1) {
      for (const item of part.items) lines.push(`   - ${item.qty}× ${item.name}: ${fmt(item.total)}`);
    }
    lines.push('');
  }
  lines.push(`TOTAL: ${fmt(summary.total)}`);
  lines.push(`Efectivo: ${fmt(summary.cash)}`);
  lines.push(`Bizum: ${fmt(summary.bizum)}`);
  return lines.join('\n');
}

const decimal = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

function csvCell(value: string): string {
  // Evita que Excel interprete como fórmula un nombre que empiece por = + - @
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Detalle venta a venta, en CSV con ";" (el separador que espera Excel en español). */
export function salesCsv(sales: Sale[]): string {
  const rows: string[][] = [
    ['Fecha', 'Hora', 'Tipo', 'Producto', 'Precio', 'Cantidad', 'Importe', 'Pago'],
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const sale of [...sales].sort((a, b) => a.at - b.at)) {
    const when = new Date(sale.at);
    const date = shortDate(
      `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
    );
    for (const item of sale.items) {
      rows.push([
        date,
        timeOf(sale.at),
        KIND_META[sale.kind].label,
        csvCell(item.name),
        decimal(item.price),
        String(item.qty),
        decimal(item.price * item.qty),
        PAY_LABEL[sale.payment],
      ]);
    }
  }
  return '﻿' + rows.map((row) => row.join(';')).join('\r\n');
}

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
