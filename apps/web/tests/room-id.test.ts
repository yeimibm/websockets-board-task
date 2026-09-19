import { normalizeRoomId, roomPath } from '@collab/websocket-protocol';
import { describe, expect, it } from 'vitest';

describe('room id contract', () => {
  it('normalizes room ids and shared links', () => {
    expect(normalizeRoomId('  team_board-7  ')).toBe('team_board-7');
    expect(normalizeRoomId('https://canvas.test/projects/team_board-7')).toBe('team_board-7');
    expect(normalizeRoomId('/projects/team_board-7/')).toBe('team_board-7');
    expect(roomPath('team_board-7')).toBe('/projects/team_board-7');
  });

  it('rejects values the FastAPI room contract rejects', () => {
    expect(normalizeRoomId('team board')).toBeNull();
    expect(normalizeRoomId('room/other')).toBeNull();
    expect(normalizeRoomId('-starts-with-symbol')).toBeNull();
    expect(normalizeRoomId('a'.repeat(65))).toBeNull();
    expect(normalizeRoomId('https://canvas.test/not-a-room/team')).toBeNull();
  });
});
