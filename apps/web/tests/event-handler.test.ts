import type { ServerMessage } from '@collab/websocket-protocol';
import { BoardStore } from '../src/client/state/board-store';
import { handleServerEvent } from '../src/client/websocket/event-handler';
import { describe, expect, it } from 'vitest';

const serverEvent = (value: Record<string, unknown>): ServerMessage => value as unknown as ServerMessage;

describe('handleServerEvent', () => {
  it('applies incremental block movement and advances the server version', () => {
    const store = new BoardStore('room-a');
    store.replaceSnapshot({
      version: 1, participants: [], connections: [],
      blocks: [{ id: 'b-1', x: 0, y: 0, width: 180, height: 90, text: 'API', updatedAt: 'now', version: 1 }],
    });
    handleServerEvent(store, serverEvent({ type: 'block_moved', roomId: 'room-a', userId: 'u-1', timestamp: 'now', version: 2, sequence: 2, payload: { blockId: 'b-1', x: 90, y: 120 } }));
    expect(store.state.blocks.get('b-1')).toMatchObject({ x: 90, y: 120, version: 2 });
    expect(store.state.version).toBe(2);
  });

  it('removes related connections with a deleted block', () => {
    const store = new BoardStore('room-a');
    store.replaceSnapshot({
      version: 1, participants: [],
      blocks: [{ id: 'b-1', x: 0, y: 0, width: 180, height: 90, text: 'API', updatedAt: 'now', version: 1 }],
      connections: [{ id: 'c-1', sourceBlockId: 'b-1', targetBlockId: 'b-2', type: 'arrow' }],
    });
    handleServerEvent(store, serverEvent({ type: 'block_deleted', roomId: 'room-a', userId: 'u-1', timestamp: 'now', version: 2, sequence: 2, payload: { blockId: 'b-1', removedConnectionIds: ['c-1'] } }));
    expect(store.state.blocks.size).toBe(0);
    expect(store.state.connections.size).toBe(0);
  });

  it('keeps cursor movement ephemeral and does not advance board version', () => {
    const store = new BoardStore('room-a');
    store.replaceSnapshot({ version: 7, participants: [{ id: 'u-2', name: 'Carlos', color: '#0ea5e9', connected: true }], blocks: [], connections: [] });
    handleServerEvent(store, serverEvent({ type: 'cursor_move', roomId: 'room-a', userId: 'u-2', timestamp: 'now', payload: { x: 4, y: 9 } }));
    expect(store.state.remoteCursors.get('u-2')).toMatchObject({ x: 4, y: 9 });
    expect(store.state.version).toBe(7);
  });
});
