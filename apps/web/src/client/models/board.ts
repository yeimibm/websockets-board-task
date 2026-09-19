import type {
  Block as ProtocolBlock,
  Connection as ProtocolConnection,
  Participant as ProtocolParticipant,
} from '@collab/websocket-protocol';

export type Block = ProtocolBlock;
export type Connection = ProtocolConnection;
export type Participant = ProtocolParticipant;

export interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
  timestamp: string;
}

export type Tool = 'select' | 'block' | 'connect' | 'edit' | 'delete';
