import type { ConnectionState } from '../state/board-store';

const labels: Record<ConnectionState, string> = {
  DISCONNECTED: 'Disconnected', CONNECTING: 'Connecting…', SYNCING: 'Syncing…',
  READY: 'Connected', RECONNECTING: 'Reconnecting…',
};

export function connectionStatus(state: ConnectionState): string {
  const ready = state === 'READY';
  return `<span class="status-pill ${ready ? 'status-ready' : ''}" aria-live="polite">
    <span class="status-dot"></span>${labels[state]}
  </span>`;
}
