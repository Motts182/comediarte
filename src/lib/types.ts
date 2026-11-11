export type Kind = 'ticket' | 'drink' | 'food';
export type ProductKind = 'drink' | 'food';
export type Payment = 'cash' | 'bizum';

/** Todos los importes van en céntimos (enteros) para no arrastrar decimales. */
export interface TicketType {
  id: string;
  name: string;
  price: number;
}

export interface EventDoc {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  tickets: TicketType[];
  closed: boolean;
  closedAt?: number;
  /** Foto de los totales al cerrar, para mostrarla en el listado de eventos. */
  totals?: { tickets: number; total: number };
  deleted?: boolean;
  updatedAt: number;
}

export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  price: number;
  /** Si es false no aparece en la pantalla de venta. */
  active: boolean;
  deleted?: boolean;
  updatedAt: number;
}

/** Copia del nombre y precio en el momento de la venta: cambiar la carta no altera lo ya vendido. */
export interface SaleItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Sale {
  id: string;
  kind: Kind;
  items: SaleItem[];
  total: number;
  payment: Payment;
  at: number;
}

export interface DeviceLog {
  device: string;
  sales: Sale[];
  deleted: string[];
}

export const KINDS: Kind[] = ['ticket', 'drink', 'food'];

export const KIND_META: Record<Kind, { icon: string; label: string; unit: string }> = {
  ticket: { icon: '🎟️', label: 'Entradas', unit: 'entradas' },
  drink: { icon: '🍺', label: 'Bebidas', unit: 'unidades' },
  food: { icon: '🍔', label: 'Comida', unit: 'unidades' },
};

export const PAY_LABEL: Record<Payment, string> = { cash: 'Efectivo', bizum: 'Bizum' };
