import { useOnline } from '../lib/api';

/** Punto de estado: verde = todo guardado, ámbar = enviando, rojo = sin conexión (se guarda en el móvil). */
export function SyncBadge({ pending }: { pending: number }) {
  const online = useOnline();
  const state = !online ? 'off' : pending > 0 ? 'busy' : 'ok';
  const label = !online
    ? pending > 0
      ? `Sin conexión · ${pending} sin enviar`
      : 'Sin conexión'
    : pending > 0
      ? 'Enviando…'
      : 'Sincronizado';
  return (
    <span className={`sync sync-${state}`} role="status" aria-label={label} title={label}>
      <i />
      {state !== 'ok' && <em>{label}</em>}
    </span>
  );
}
