import type { Block, Connection, Participant, RemoteCursor } from '../models/board';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'SYNCING' | 'READY' | 'RECONNECTING';

export interface BoardState {
  roomId: string;
  version: number;
  connectionState: ConnectionState;
  currentUser: Participant | null;
  participants: Map<string, Participant>;
  remoteCursors: Map<string, RemoteCursor>;
  blocks: Map<string, Block>;
  connections: Map<string, Connection>;
  rejection: string | null;
}

type Listener = (state: Readonly<BoardState>) => void;

export class BoardStore {
  private listeners = new Set<Listener>();
  readonly state: BoardState;

  constructor(roomId: string) {
    this.state = {
      roomId,
      version: 0,
      connectionState: 'DISCONNECTED',
      currentUser: null,
      participants: new Map(),
      remoteCursors: new Map(),
      blocks: new Map(),
      connections: new Map(),
      rejection: null,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setConnectionState(connectionState: ConnectionState): void {
    this.state.connectionState = connectionState;
    this.emit();
  }

  replaceSnapshot(input: {
    version: number;
    userId?: string;
    participants: Participant[];
    blocks: Block[];
    connections: Connection[];
  }): void {
    this.state.version = input.version;
    this.state.participants = new Map(input.participants.map((value) => [value.id, value]));
    this.state.blocks = new Map(input.blocks.map((value) => [value.id, value]));
    this.state.connections = new Map(input.connections.map((value) => [value.id, value]));
    this.state.remoteCursors.clear();
    if (input.userId) this.state.currentUser = this.state.participants.get(input.userId) ?? null;
    this.state.rejection = null;
    this.state.connectionState = 'READY';
    this.emit();
  }

  applyVersion(version: number, update: () => void): void {
    if (version <= this.state.version) return;
    update();
    this.state.version = version;
    this.emit();
  }

  upsertParticipant(participant: Participant): void {
    this.state.participants.set(participant.id, participant);
    if (participant.id === this.state.currentUser?.id) this.state.currentUser = participant;
    this.emit();
  }

  removeParticipant(userId: string): void {
    this.state.participants.delete(userId);
    this.state.remoteCursors.delete(userId);
    this.emit();
  }

  setCursor(cursor: RemoteCursor): void {
    if (cursor.userId === this.state.currentUser?.id) return;
    this.state.remoteCursors.set(cursor.userId, cursor);
    this.emit();
  }

  reject(reason: string): void {
    this.state.rejection = reason;
    this.emit();
  }

  isEditable(): boolean { return this.state.connectionState === 'READY'; }

  private emit(): void { this.listeners.forEach((listener) => listener(this.state)); }
}
