import type { ClientMessage, ServerMessage } from '@collab/websocket-protocol';

export type { ClientMessage, ServerMessage };

export interface MessageEnvelope {
  type: string;
  roomId: string;
  userId: string;
  timestamp: string;
  operationId?: string;
  version?: number;
  sequence?: number;
  payload: Record<string, unknown>;
}

export function operationId(): string { return crypto.randomUUID(); }

export function envelope(
  type: string,
  roomId: string,
  userId: string,
  payload: Record<string, unknown>,
  includeOperation = false,
): ClientMessage {
  return {
    type,
    roomId,
    userId,
    timestamp: new Date().toISOString(),
    payload,
    ...(includeOperation ? { operationId: operationId() } : {}),
  } as ClientMessage;
}
