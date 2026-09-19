export interface Point {
  x: number;
  y: number;
}

export interface DragBounds {
  width: number;
  height: number;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function draggedPosition(
  start: Point,
  pointerStart: Point,
  pointerCurrent: Point,
  block: DragBounds,
  canvas: DragBounds,
): Point {
  return {
    x: Math.round(clamp(start.x + pointerCurrent.x - pointerStart.x, 0, canvas.width - block.width)),
    y: Math.round(clamp(start.y + pointerCurrent.y - pointerStart.y, 0, canvas.height - block.height)),
  };
}
