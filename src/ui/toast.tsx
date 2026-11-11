import { useSyncExternalStore } from 'react';

interface ToastData {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

let current: ToastData | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Quita el aviso visible, si lo hay. Se usa también al cambiar de pantalla. */
export function dismissToast(): void {
  if (!current) return;
  clearTimeout(timer);
  current = null;
  emit();
}

/** Aviso breve arriba de la pantalla, con una acción opcional (p. ej. "Deshacer"). */
export function toast(text: string, action?: ToastData['action']): void {
  clearTimeout(timer);
  current = { id: Date.now(), text, action };
  emit();
  timer = setTimeout(dismissToast, action ? 6000 : 2500);
}

export function ToastHost() {
  const data = useSyncExternalStore(subscribe, () => current);
  if (!data) return null;
  const { action } = data;
  return (
    <div className="toast" role="status" key={data.id}>
      <span>{data.text}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.run();
            dismissToast();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
