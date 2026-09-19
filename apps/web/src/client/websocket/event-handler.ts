import type { Block, Connection, Participant } from '../models/board';
import { BoardStore } from '../state/board-store';
import type { MessageEnvelope, ServerMessage } from './protocol';

export function handleServerEvent(store: BoardStore, message: ServerMessage): void {
  const event = message as unknown as MessageEnvelope;
  const payload = event.payload;
  const version = event.version ?? store.state.version;

  switch (event.type) {
    case 'room_snapshot':
      store.replaceSnapshot({
        version,
        userId: event.userId,
        participants: (payload.participants as Participant[]) ?? [],
        blocks: (payload.blocks as Block[]) ?? [],
        connections: (payload.connections as Connection[]) ?? [],
      });
      break;
    case 'participant_joined':
      store.upsertParticipant((payload.participant ?? payload) as unknown as Participant);
      break;
    case 'participant_left':
      store.removeParticipant(String(payload.userId ?? payload.id));
      break;
    case 'cursor_move':
      store.setCursor({
        userId: event.userId,
        x: Number(payload.x),
        y: Number(payload.y),
        timestamp: event.timestamp,
      });
      break;
    case 'block_created':
      store.applyVersion(version, () => {
        const block = (payload.block ?? payload) as unknown as Block;
        store.state.blocks.set(block.id, block);
      });
      break;
    case 'block_moved':
      store.applyVersion(version, () => {
        const blockId = String(payload.blockId);
        const current = store.state.blocks.get(blockId);
        if (current) store.state.blocks.set(blockId, { ...current, x: Number(payload.x), y: Number(payload.y), version });
      });
      break;
    case 'block_updated':
      store.applyVersion(version, () => {
        const block = payload.block as Block | undefined;
        if (block) store.state.blocks.set(block.id, block);
        else {
          const blockId = String(payload.blockId);
          const current = store.state.blocks.get(blockId);
          if (current) store.state.blocks.set(blockId, { ...current, ...payload, version } as Block);
        }
      });
      break;
    case 'block_deleted':
      store.applyVersion(version, () => {
        const blockId = String(payload.blockId);
        store.state.blocks.delete(blockId);
        const removed = new Set((payload.removedConnectionIds as string[] | undefined) ?? []);
        for (const [id, connection] of store.state.connections) {
          if (removed.has(id) || connection.sourceBlockId === blockId || connection.targetBlockId === blockId) {
            store.state.connections.delete(id);
          }
        }
      });
      break;
    case 'connection_created':
      store.applyVersion(version, () => {
        const connection = (payload.connection ?? payload) as unknown as Connection;
        store.state.connections.set(connection.id, connection);
      });
      break;
    case 'connection_deleted':
      store.applyVersion(version, () => store.state.connections.delete(String(payload.connectionId)));
      break;
    case 'operation_rejected':
      store.reject(String(payload.reason ?? 'Operation rejected'));
      break;
  }
}
