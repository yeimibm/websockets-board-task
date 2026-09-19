import './styles/input.css';
import { normalizeRoomId } from '@collab/websocket-protocol';
import { boardPage } from './pages/board';
import { dashboardPage } from './pages/dashboard';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found');
const appRoot = root;
let cleanup = (): void => undefined;

function route(): void {
  cleanup();
  const match = location.pathname.match(/^\/projects\/([^/]+)\/?$/);
  let roomId: string | null = null;
  if (match?.[1]) {
    try { roomId = normalizeRoomId(decodeURIComponent(match[1])); }
    catch { roomId = null; }
  }
  cleanup = roomId ? boardPage(appRoot, roomId) : dashboardPage(appRoot, match ? 'That shared room link is invalid.' : undefined);
}

window.addEventListener('popstate', route);
document.addEventListener('click', (event) => {
  if (event.defaultPrevented) return;
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/"]');
  if (!anchor) return;
  event.preventDefault(); history.pushState({}, '', anchor.href); route();
});
route();
