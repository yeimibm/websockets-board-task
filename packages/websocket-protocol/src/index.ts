export type ISODateTime = string;

export const ROOM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * Accepts a room id or a shared board URL and returns the canonical room id.
 * Room ids remain case-sensitive; normalization only removes transport/UI noise.
 */
export function normalizeRoomId(input: string): string | null {
  let candidate = input.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate, 'https://collab.local');
    const match = url.pathname.match(/^\/projects\/([^/]+)\/?$/);
    if (match?.[1]) candidate = decodeURIComponent(match[1]);
    else if (/^(?:https?:\/\/|\/)/i.test(candidate)) return null;
  } catch {
    return null;
  }

  candidate = candidate.trim();
  return ROOM_ID_PATTERN.test(candidate) ? candidate : null;
}

export function roomPath(roomId: string): string {
  const normalized = normalizeRoomId(roomId);
  if (!normalized) throw new Error('INVALID_ROOM_ID');
  return `/projects/${encodeURIComponent(normalized)}`;
}

export interface Participant {
  id: string;
  name: string;
  color: string;
  connected: boolean;
}

export interface Block {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  updatedAt: ISODateTime;
  version: number;
}

export type ConnectionType = "arrow" | "line";

export interface Connection {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  type: ConnectionType;
}

export interface RoomSnapshot {
  participants: Participant[];
  blocks: Block[];
  connections: Connection[];
}

export type BoardSnapshot = RoomSnapshot;

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  timestamp: ISODateTime;
}

interface ClientEnvelope<Type extends string, Payload> {
  type: Type;
  roomId: string;
  userId?: string;
  timestamp?: ISODateTime;
  operationId?: string;
  payload: Payload;
}

interface ServerEnvelope<Type extends string, Payload> {
  type: Type;
  roomId: string;
  userId: string;
  timestamp: ISODateTime;
  version?: number;
  sequence?: number;
  operationId?: string;
  payload: Payload;
}

export type JoinRoomMessage = ClientEnvelope<"join_room", { name: string }>;
export type CursorMoveRequest = ClientEnvelope<"cursor_move", { x: number; y: number }>;
export type SnapshotRequest = ClientEnvelope<"snapshot_request", Record<string, never>>;
type MutationRequest<Type extends string, Payload> = ClientEnvelope<Type, Payload> & {
  operationId: string;
};
export type BlockCreateRequest = MutationRequest<
  "block_create",
  { x: number; y: number; width: number; height: number; text: string }
>;
export type BlockMoveRequest = MutationRequest<"block_move", { blockId: string; x: number; y: number }>;
export type BlockUpdateRequest = MutationRequest<
  "block_update",
  { blockId: string; text?: string; width?: number; height?: number }
>;
export type BlockDeleteRequest = MutationRequest<"block_delete", { blockId: string }>;
export type ConnectionCreateRequest = MutationRequest<
  "connection_create",
  { sourceBlockId: string; targetBlockId: string; type?: ConnectionType }
>;
export type ConnectionDeleteRequest = MutationRequest<"connection_delete", { connectionId: string }>;

export type ClientMessage =
  | JoinRoomMessage
  | CursorMoveRequest
  | SnapshotRequest
  | BlockCreateRequest
  | BlockMoveRequest
  | BlockUpdateRequest
  | BlockDeleteRequest
  | ConnectionCreateRequest
  | ConnectionDeleteRequest;

export type RoomSnapshotMessage = ServerEnvelope<"room_snapshot", RoomSnapshot> & { version: number };
export type ParticipantJoinedMessage = ServerEnvelope<"participant_joined", Participant>;
export type ParticipantLeftMessage = ServerEnvelope<"participant_left", { id: string }>;
export type CursorMoveMessage = ServerEnvelope<"cursor_move", { x: number; y: number }>;
type AcceptedMutation = { version: number; sequence: number; operationId: string };

export type BlockCreatedMessage = ServerEnvelope<"block_created", { block: Block }> &
  AcceptedMutation;
export type BlockMovedMessage = ServerEnvelope<
  "block_moved",
  { blockId: string; x: number; y: number }
> & AcceptedMutation;
export type BlockUpdatedMessage = ServerEnvelope<
  "block_updated",
  { block: Block }
> & AcceptedMutation;
export type BlockDeletedMessage = ServerEnvelope<
  "block_deleted",
  { blockId: string; removedConnectionIds: string[] }
> & AcceptedMutation;
export type ConnectionCreatedMessage = ServerEnvelope<
  "connection_created",
  { connection: Connection }
> & AcceptedMutation;
export type ConnectionDeletedMessage = ServerEnvelope<"connection_deleted", { connectionId: string }> & {
  version: number;
  sequence: number;
  operationId: string;
};

export type RejectionReason =
  | "INVALID_ROOM"
  | "NOT_JOINED"
  | "UNKNOWN_EVENT"
  | "BLOCK_NOT_FOUND"
  | "CONNECTION_NOT_FOUND"
  | "INVALID_COORDINATES"
  | "INVALID_TEXT"
  | "INVALID_CONNECTION"
  | "ROOM_MISMATCH"
  | "INVALID_ROOM_ID"
  | "INVALID_MESSAGE"
  | "INVALID_JOIN"
  | "JOIN_REQUIRED"
  | "ALREADY_JOINED"
  | "USER_ID_REQUIRED"
  | "USER_MISMATCH"
  | "UNKNOWN_EVENT_TYPE"
  | "INVALID_EVENT"
  | "INVALID_DIMENSIONS"
  | "TEXT_TOO_LONG"
  | "EMPTY_UPDATE"
  | "SELF_CONNECTION_NOT_ALLOWED"
  | "CONNECTION_ALREADY_EXISTS";

export type OperationRejectedMessage = ServerEnvelope<
  "operation_rejected",
  { reason: RejectionReason; details?: string }
>;

export type BoardDelta =
  | BlockCreatedMessage
  | BlockMovedMessage
  | BlockUpdatedMessage
  | BlockDeletedMessage
  | ConnectionCreatedMessage
  | ConnectionDeletedMessage;

export type ServerMessage =
  | RoomSnapshotMessage
  | ParticipantJoinedMessage
  | ParticipantLeftMessage
  | CursorMoveMessage
  | BoardDelta
  | OperationRejectedMessage;
