import { draggedPosition } from '../src/client/components/drag-geometry';
import { describe, expect, it } from 'vitest';

describe('draggedPosition', () => {
  it('preserves the initial grab offset while moving a block', () => {
    expect(draggedPosition(
      { x: 100, y: 80 },
      { x: 130, y: 100 },
      { x: 250, y: 170 },
      { width: 180, height: 90 },
      { width: 1000, height: 700 },
    )).toEqual({ x: 220, y: 150 });
  });

  it('keeps the whole block inside every canvas edge', () => {
    const block = { width: 180, height: 90 };
    const canvas = { width: 800, height: 500 };
    expect(draggedPosition({ x: 10, y: 10 }, { x: 20, y: 20 }, { x: -100, y: -100 }, block, canvas))
      .toEqual({ x: 0, y: 0 });
    expect(draggedPosition({ x: 600, y: 380 }, { x: 10, y: 10 }, { x: 300, y: 300 }, block, canvas))
      .toEqual({ x: 620, y: 410 });
  });

  it('returns safe coordinates for non-finite pointer input', () => {
    expect(draggedPosition(
      { x: 20, y: 30 },
      { x: 0, y: 0 },
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      { width: 180, height: 90 },
      { width: 800, height: 500 },
    )).toEqual({ x: 0, y: 0 });
  });
});
