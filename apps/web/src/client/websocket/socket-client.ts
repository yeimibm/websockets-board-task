import { normalizeRoomId } from '@collab/websocket-protocol';
import { BoardStore } from '../state/board-store';
import { handleServerEvent } from './event-handler';
import { envelope, type ServerMessage } from './protocol';

type SocketFactory = (url: string) => WebSocket;

export class RoomSocketClient {
  private socket: WebSocket | null = null;
  private retryTimer: number | undefined;
  private reconnectAttempt = 0;
  private stopped = false;
  private hasConnected = false;

  constructor(
    private readonly store: BoardStore,
    private readonly name: string,
    private readonly baseUrl: string,
    private readonly socketFactory: SocketFactory = (url) => new WebSocket(url),
  ) {}

  connect(): void {
    this.stopped = false;
    this.open();
  }

  disconnect(): void {
    this.stopped = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close(1000, 'User left');
    this.socket = null;
    this.store.setConnectionState('DISCONNECTED');
  }

  send(type: string, payload: Record<string, unknown>, mutating = true): boolean {
    if (this.store.state.connectionState !== 'READY' || this.socket?.readyState !== WebSocket.OPEN) return false;
    const userId = this.store.state.currentUser?.id;
    if (!userId) return false;
    this.socket.send(JSON.stringify(envelope(type, this.store.state.roomId, userId, payload, mutating)));
    return true;
  }

  private open(): void {
    const roomId = normalizeRoomId(this.store.state.roomId);
    if (!roomId) {
      this.stopped = true;
      this.store.reject('INVALID_ROOM_ID');
      this.store.setConnectionState('DISCONNECTED');
      return;
    }
    this.store.setConnectionState(this.hasConnected ? 'RECONNECTING' : 'CONNECTING');
    const url = `${this.baseUrl.replace(/\/$/, '')}/ws/rooms/${encodeURIComponent(roomId)}`;
    const socket = this.socketFactory(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.hasConnected = true;
      this.reconnectAttempt = 0;
      this.store.setConnectionState('SYNCING');
      socket.send(JSON.stringify(envelope('join_room', this.store.state.roomId, '', { name: this.name })));
    });
    socket.addEventListener('message', (incoming) => {
      try {
        const message = JSON.parse(String(incoming.data)) as ServerMessage;
        handleServerEvent(this.store, message);
        if (message.type === 'operation_rejected' && message.payload.reason === 'INVALID_ROOM_ID') {
          this.stopped = true;
          this.store.setConnectionState('DISCONNECTED');
          socket.close(1008, 'Invalid room ID');
        }
      }
      catch { this.store.reject('INVALID_SERVER_MESSAGE'); }
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket || this.stopped) return;
      this.socket = null;
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => socket.close());
  }

  private scheduleReconnect(): void {
    this.store.setConnectionState('RECONNECTING');
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempt, 10_000) + Math.random() * 250;
    this.reconnectAttempt += 1;
    this.retryTimer = window.setTimeout(() => this.open(), delay);
  }
}
