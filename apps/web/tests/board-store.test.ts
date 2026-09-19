import type { Block, Connection, Participant } from '../src/client/models/board';
import { BoardStore } from '../src/client/state/board-store';
import { describe, expect, it } from 'vitest';

const participant: Participant = { id: 'u-1', name: 'Yeimi', color: '#6366f1', connected: true };
const block: Block = { id: 'b-1', x: 10, y: 20, width: 180, height: 90, text: 'API', updatedAt: '2026-01-01T00:00:00Z', version: 3 };
const connection: Connection = { id: 'c-1', sourceBlockId: 'b-1', targetBlockId: 'b-2', type: 'arrow' };

describe('BoardStore', () => {
  it('keeps editing locked until an authoritative snapshot arrives', () => {
    const store = new BoardStore('room-a');
    store.setConnectionState('SYNCING');
    expect(store.isEditable()).toBe(false);

    store.replaceSnapshot({ version: 3, userId: 'u-1', participants: [participant], blocks: [block], connections: [connection] });

    expect(store.isEditable()).toBe(true);
    expect(store.state.currentUser).toEqual(participant);
    expect(store.state.blocks.get('b-1')).toEqual(block);
  });

  it('ignores duplicate and out-of-order deltas', () => {
    const store = new BoardStore('room-a');
    store.replaceSnapshot({ version: 3, participants: [], blocks: [block], connections: [] });
    store.applyVersion(5, () => store.state.blocks.set('b-1', { ...block, x: 50 }));
    store.applyVersion(4, () => store.state.blocks.set('b-1', { ...block, x: 40 }));

    expect(store.state.version).toBe(5);
    expect(store.state.blocks.get('b-1')?.x).toBe(50);
  });

  it('does not persist cursor data in a replacement snapshot', () => {
    const store = new BoardStore('room-a');
    store.setCursor({ userId: 'u-2', x: 1, y: 2, timestamp: 'now' });
    store.replaceSnapshot({ version: 1, participants: [], blocks: [], connections: [] });
    expect(store.state.remoteCursors.size).toBe(0);
  });
});
