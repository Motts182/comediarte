import { createContext, useContext } from 'react';
import type { EventDoc, Product } from './types';

export interface Data {
  events: EventDoc[];
  products: Product[];
  saveEvent: (event: EventDoc) => void;
  saveProduct: (product: Product) => void;
  /** true cuando ya se intentó la primera carga (haya ido bien o no). */
  loaded: boolean;
  /** Cambios de eventos/carta que aún no han llegado al servidor. */
  pending: number;
}

export const DataContext = createContext<Data | null>(null);

export function useData(): Data {
  const data = useContext(DataContext);
  if (!data) throw new Error('useData fuera de DataContext');
  return data;
}
