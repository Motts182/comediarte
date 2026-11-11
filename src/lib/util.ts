import type { EventDoc } from './types';

export function uid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Marca de tiempo para un documento editado; siempre mayor que la anterior aunque el reloj del móvil vaya atrasado. */
export const stamp = (previous?: { updatedAt: number }) =>
  Math.max(Date.now(), (previous?.updatedAt ?? 0) + 1);

const eurWhole = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const eurCents = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** 1250 → "12,50 €", 1200 → "12 €" */
export const fmt = (cents: number) => (cents % 100 === 0 ? eurWhole : eurCents).format(cents / 100);

/** "2,50" | "2.5" | "3" → céntimos; null si no es un importe válido. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[\s€]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/** Céntimos → texto para un campo de formulario ("2,50", "3"). */
export const moneyInput = (cents: number) =>
  (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2).replace('.', ',');

const pad = (n: number) => String(n).padStart(2, '0');

export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2026-11-20" → "20/11/2026" */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });

/** "2026-11-20" → "viernes 20/11/2026" */
export function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${weekday.format(new Date(year, month - 1, day))} ${shortDate(iso)}`;
}

export const eventTitle = (event: Pick<EventDoc, 'name' | 'date'>) =>
  `${event.name} del ${shortDate(event.date)}`;

const clock = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
export const timeOf = (timestamp: number) => clock.format(timestamp);

const dayAndTime = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
export const dateTimeOf = (timestamp: number) => dayAndTime.format(timestamp);

export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
