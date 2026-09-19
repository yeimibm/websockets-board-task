import { roomPath } from '@collab/websocket-protocol';
import { BoardCanvas } from '../components/board-canvas';
import { boardToolbar } from '../components/board-toolbar';
import { connectionStatus } from '../components/connection-status';
import { avatarStack, escapeHtml, participantsList } from '../components/participants';
import type { Tool } from '../models/board';
import { BoardStore } from '../state/board-store';
import { RoomSocketClient } from '../websocket/socket-client';

export function boardPage(root: HTMLElement, roomId: string): () => void {
  const controller = new AbortController();
  const storedName = sessionStorage.getItem(`identity:${roomId}`);
  const store = new BoardStore(roomId);
  const defaultSocketUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8000`;
  let socket: RoomSocketClient | null = null;
  let tool: Tool = 'select';

  root.innerHTML = `<main class="board-shell">
    <header class="board-header">
      <a href="/" data-back class="board-brand" aria-label="Back to projects"><span>◇</span><strong>Canvas Rooms</strong></a>
      <div class="board-title"><h1>${escapeHtml(roomId)}</h1><span>Collaborative board</span></div>
      <div class="board-header-actions">
        <div class="avatar-stack" id="avatar-stack" aria-label="Active collaborators"></div>
        <button class="share-button" data-share><span>♙</span> Share</button>
        <div id="connection-status"></div>
        <button class="header-menu" data-toggle-people aria-label="Toggle collaborators">•••</button>
      </div>
    </header>
    <div class="board-body">
      <aside class="people-panel" id="people-panel">
        <div class="people-heading"><div><p class="eyebrow">Live room</p><h2>Collaborators</h2></div><button data-toggle-people aria-label="Close collaborators">×</button></div>
        <p class="people-copy">Everyone viewing this board appears here in real time.</p>
        <div id="participants"></div>
        <button class="invite-panel-button" data-share>＋ Invite collaborator</button>
        <div class="sync-note"><strong>Live synchronization</strong><p>Changes unlock after the latest server snapshot arrives.</p></div>
      </aside>
      <section class="board-workspace">
        <div id="toolbar"></div>
        <div class="offline-banner" id="offline-banner">Editing is paused while the board synchronizes.</div>
        <div class="board-canvas" id="board-canvas" tabindex="0"></div>
        <div class="error-toast" id="error-toast"></div>
      </section>
    </div>
    <dialog class="modal share-modal" id="share-dialog"><form method="dialog">
      <button class="modal-close" value="cancel" aria-label="Close">×</button>
      <p class="eyebrow">Invite to board</p><h2>Share this room</h2>
      <p class="modal-copy">Anyone with this link can enter a display name and collaborate live.</p>
      <label>Share link<div class="copy-field"><input data-share-url readonly /><button type="button" data-copy>Copy link</button></div></label>
      <p class="share-room-id">Room ID <code>${escapeHtml(roomId)}</code></p>
      <p class="copy-feedback" data-copy-feedback aria-live="polite"></p>
    </form></dialog>
    <dialog class="modal join-room-modal" id="join-dialog"><form id="join-form">
      <p class="eyebrow">You were invited</p><h2>Join ${escapeHtml(roomId)}</h2>
      <p class="modal-copy">Choose the name your collaborators will see.</p>
      <label>Your name<input name="userName" maxlength="40" required autocomplete="name" placeholder="Your name" value="${escapeHtml(localStorage.getItem('last-identity') ?? '')}" /></label>
      <button class="primary-button" type="submit">Join board</button>
      <a href="/" class="cancel-link">Back to projects</a>
    </form></dialog>
  </main>`;

  const canvasRoot = root.querySelector<HTMLElement>('#board-canvas')!;
  const peoplePanel = root.querySelector<HTMLElement>('#people-panel')!;
  const shareDialog = root.querySelector<HTMLDialogElement>('#share-dialog')!;
  const joinDialog = root.querySelector<HTMLDialogElement>('#join-dialog')!;
  const joinForm = root.querySelector<HTMLFormElement>('#join-form')!;
  const shareUrl = `${location.origin}${roomPath(roomId)}`;
  root.querySelector<HTMLInputElement>('[data-share-url]')!.value = shareUrl;

  const canvas = new BoardCanvas(canvasRoot, store, (type, payload, mutating) => socket?.send(type, payload, mutating) ?? false);
  canvas.mount();

  const start = (name: string): void => {
    if (socket) return;
    sessionStorage.setItem(`identity:${roomId}`, name);
    localStorage.setItem('last-identity', name);
    socket = new RoomSocketClient(store, name, import.meta.env.VITE_WS_URL ?? defaultSocketUrl);
    socket.connect();
  };

  const unsubscribe = store.subscribe((state) => {
    const participantArray = [...state.participants.values()];
    root.querySelector('#connection-status')!.innerHTML = connectionStatus(state.connectionState);
    root.querySelector('#participants')!.innerHTML = participantsList(participantArray, state.currentUser?.id);
    root.querySelector('#avatar-stack')!.innerHTML = avatarStack(participantArray);
    root.querySelector('#toolbar')!.innerHTML = boardToolbar(tool, state.connectionState === 'READY');
    root.querySelector('#offline-banner')!.classList.toggle('visible', state.connectionState !== 'READY');
    const toast = root.querySelector<HTMLElement>('#error-toast')!;
    toast.textContent = state.rejection ? `Could not apply change: ${state.rejection}` : '';
    toast.classList.toggle('visible', Boolean(state.rejection));
  });

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const toolButton = target.closest<HTMLElement>('[data-tool]');
    if (toolButton?.dataset.tool && store.isEditable()) { tool = toolButton.dataset.tool as Tool; canvas.setTool(tool); }
    if (target.closest('[data-back]')) socket?.disconnect();
    if (target.closest('[data-share]')) shareDialog.showModal();
    if (target.closest('[data-toggle-people]')) peoplePanel.classList.toggle('open');
    if (target.closest('[data-copy]')) {
      void navigator.clipboard.writeText(shareUrl).then(() => {
        root.querySelector<HTMLElement>('[data-copy-feedback]')!.textContent = 'Link copied to clipboard.';
      }).catch(() => {
        root.querySelector<HTMLInputElement>('[data-share-url]')!.select();
        root.querySelector<HTMLElement>('[data-copy-feedback]')!.textContent = 'Select the link and copy it manually.';
      });
    }
  }, { signal: controller.signal });

  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = String(new FormData(joinForm).get('userName') ?? '').trim();
    if (!name) return;
    joinDialog.close();
    start(name);
  }, { signal: controller.signal });

  if (storedName) start(storedName);
  else joinDialog.showModal();

  return () => { controller.abort(); unsubscribe(); canvas.destroy(); socket?.disconnect(); };
}
