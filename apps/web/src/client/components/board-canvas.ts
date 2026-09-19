import type { Tool } from '../models/board';
import { BoardStore } from '../state/board-store';
import { draggedPosition, type Point } from './drag-geometry';
import { escapeHtml } from './participants';

type SendOperation = (type: string, payload: Record<string, unknown>, mutating?: boolean) => boolean;

interface ActiveDrag {
  pointerId: number;
  blockId: string;
  element: HTMLElement;
  pointerStart: Point;
  blockStart: Point;
  position: Point;
  width: number;
  height: number;
}

export class BoardCanvas {
  private tool: Tool = 'select';
  private connectionStart: string | null = null;
  private lastCursorSent = 0;
  private lastMoveSent = 0;
  private unsubscribe: (() => void) | null = null;
  private activeDrag: ActiveDrag | null = null;
  private readonly pendingPositions = new Map<string, Point>();
  private readonly controller = new AbortController();

  constructor(
    private readonly root: HTMLElement,
    private readonly store: BoardStore,
    private readonly send: SendOperation,
  ) {}

  mount(): void {
    this.unsubscribe = this.store.subscribe(() => this.onStoreChange());
    const signal = this.controller.signal;
    this.root.addEventListener('pointermove', (event) => this.onPointerMove(event), { signal });
    this.root.addEventListener('pointerdown', (event) => this.onPointerDown(event), { signal });
    this.root.addEventListener('pointerup', (event) => this.finishDrag(event), { signal });
    this.root.addEventListener('pointercancel', (event) => this.cancelDrag(event.pointerId), { signal });
    this.root.addEventListener('lostpointercapture', (event) => this.cancelDrag(event.pointerId), { signal });
    this.root.addEventListener('click', (event) => this.onClick(event), { signal });
  }

  destroy(): void { this.cancelDrag(); this.controller.abort(); this.unsubscribe?.(); }
  setTool(tool: Tool): void { this.cancelDrag(); this.tool = tool; this.connectionStart = null; this.render(); }

  private onStoreChange(): void {
    if (this.store.state.rejection) this.pendingPositions.clear();
    for (const [blockId, position] of this.pendingPositions) {
      const block = this.store.state.blocks.get(blockId);
      if (!block || (block.x === position.x && block.y === position.y)) this.pendingPositions.delete(blockId);
    }
    if (this.activeDrag) {
      if (!this.store.isEditable() || !this.store.state.blocks.has(this.activeDrag.blockId)) this.cancelDrag();
      else this.patchDraggedGeometry(this.activeDrag);
      return;
    }
    this.render();
  }

  private blockPosition(blockId: string, x: number, y: number): Point {
    return this.activeDrag?.blockId === blockId
      ? this.activeDrag.position
      : this.pendingPositions.get(blockId) ?? { x, y };
  }

  private connectionPath(sourceId: string, targetId: string): string {
    const source = this.store.state.blocks.get(sourceId);
    const target = this.store.state.blocks.get(targetId);
    if (!source || !target) return '';
    const sourcePosition = this.blockPosition(source.id, source.x, source.y);
    const targetPosition = this.blockPosition(target.id, target.x, target.y);
    const sx = sourcePosition.x + source.width / 2;
    const sy = sourcePosition.y + source.height / 2;
    const tx = targetPosition.x + target.width / 2;
    const ty = targetPosition.y + target.height / 2;
    return `M ${sx} ${sy} C ${sx + 80} ${sy}, ${tx - 80} ${ty}, ${tx} ${ty}`;
  }

  private render(): void {
    const state = this.store.state;
    const connections = [...state.connections.values()].map((connection) => {
      const path = this.connectionPath(connection.sourceBlockId, connection.targetBlockId);
      return path ? `<path data-connection-id="${connection.id}" d="${path}" />` : '';
    }).join('');
    const blocks = [...state.blocks.values()].map((block) => {
      const position = this.blockPosition(block.id, block.x, block.y);
      return `
      <article class="board-block ${this.connectionStart === block.id ? 'connecting' : ''}" data-block-id="${block.id}"
        style="left:${position.x}px;top:${position.y}px;width:${block.width}px;height:${block.height}px">
        <span class="block-grip">•••</span><strong>${escapeHtml(block.text)}</strong><small>v${block.version}</small>
      </article>`;
    }).join('');
    const cursors = [...state.remoteCursors.values()].map((cursor) => {
      const participant = state.participants.get(cursor.userId);
      if (!participant) return '';
      return `<div class="remote-cursor" style="transform:translate(${cursor.x}px,${cursor.y}px);color:${participant.color}">
        <span class="cursor-arrow">◆</span><span style="background:${participant.color}">${escapeHtml(participant.name)}</span>
      </div>`;
    }).join('');
    this.root.dataset.tool = this.tool;
    this.root.innerHTML = `<svg class="connections" aria-hidden="true"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" /></marker></defs>${connections}</svg>${blocks}${cursors}
      ${state.blocks.size ? '' : '<div class="empty-board"><span>◇</span><strong>Create your first block</strong><p>Choose Block in the toolbar, then click anywhere.</p></div>'}`;
  }

  private point(event: PointerEvent | MouseEvent): { x: number; y: number } {
    const bounds = this.root.getBoundingClientRect();
    return { x: Math.round(event.clientX - bounds.left + this.root.scrollLeft), y: Math.round(event.clientY - bounds.top + this.root.scrollTop) };
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.store.isEditable()) return;
    if (this.activeDrag?.pointerId === event.pointerId) {
      event.preventDefault();
      const drag = this.activeDrag;
      drag.position = draggedPosition(
        drag.blockStart,
        drag.pointerStart,
        this.point(event),
        { width: drag.width, height: drag.height },
        { width: this.root.scrollWidth, height: this.root.scrollHeight },
      );
      this.patchDraggedGeometry(drag);
      const now = performance.now();
      if (now - this.lastMoveSent >= 50) {
        this.lastMoveSent = now;
        this.send('block_move', { blockId: drag.blockId, ...drag.position });
      }
      return;
    }
    const now = performance.now();
    if (now - this.lastCursorSent < 40) return;
    this.lastCursorSent = now;
    this.send('cursor_move', this.point(event), false);
  }

  private onClick(event: MouseEvent): void {
    if (!this.store.isEditable()) return;
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]');
    const blockId = element?.dataset.blockId;
    if (this.tool === 'block' && !blockId) {
      const point = this.point(event);
      this.send('block_create', { ...point, x: point.x - 90, y: point.y - 45, width: 180, height: 90, text: 'New block' });
    } else if (blockId && this.tool === 'edit') {
      const current = this.store.state.blocks.get(blockId);
      const text = window.prompt('Block label', current?.text ?? '');
      if (text?.trim()) this.send('block_update', { blockId, text: text.trim() });
    } else if (blockId && this.tool === 'delete') {
      this.send('block_delete', { blockId });
    } else if (blockId && this.tool === 'connect') {
      if (!this.connectionStart) this.connectionStart = blockId;
      else if (this.connectionStart !== blockId) {
        this.send('connection_create', { sourceBlockId: this.connectionStart, targetBlockId: blockId, type: 'arrow' });
        this.connectionStart = null;
      }
      this.render();
    } else if (this.tool === 'delete') {
      const path = (event.target as SVGElement).closest<SVGPathElement>('[data-connection-id]');
      if (path?.dataset.connectionId) this.send('connection_delete', { connectionId: path.dataset.connectionId });
    }
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.tool !== 'select' || !this.store.isEditable()) return;
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]');
    const block = element ? this.store.state.blocks.get(element.dataset.blockId ?? '') : undefined;
    if (!element || !block) return;
    event.preventDefault();
    this.root.setPointerCapture(event.pointerId);
    const initial = this.pendingPositions.get(block.id) ?? { x: block.x, y: block.y };
    this.activeDrag = {
      pointerId: event.pointerId,
      blockId: block.id,
      element,
      pointerStart: this.point(event),
      blockStart: initial,
      position: initial,
      width: block.width,
      height: block.height,
    };
    this.lastMoveSent = 0;
    element.classList.add('dragging');
  }

  private patchDraggedGeometry(drag: ActiveDrag): void {
    drag.element.style.left = `${drag.position.x}px`;
    drag.element.style.top = `${drag.position.y}px`;
    for (const connection of this.store.state.connections.values()) {
      if (connection.sourceBlockId !== drag.blockId && connection.targetBlockId !== drag.blockId) continue;
      const path = this.root.querySelector<SVGPathElement>(`[data-connection-id="${CSS.escape(connection.id)}"]`);
      path?.setAttribute('d', this.connectionPath(connection.sourceBlockId, connection.targetBlockId));
    }
  }

  private finishDrag(event: PointerEvent): void {
    const drag = this.activeDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    drag.element.classList.remove('dragging');
    this.activeDrag = null;
    if (this.root.hasPointerCapture(event.pointerId)) this.root.releasePointerCapture(event.pointerId);
    const changed = drag.position.x !== drag.blockStart.x || drag.position.y !== drag.blockStart.y;
    if (changed && this.store.isEditable() && this.send('block_move', { blockId: drag.blockId, ...drag.position })) {
      this.pendingPositions.set(drag.blockId, drag.position);
    }
    this.render();
  }

  private cancelDrag(pointerId?: number): void {
    const drag = this.activeDrag;
    if (!drag || (pointerId !== undefined && pointerId !== drag.pointerId)) return;
    drag.element.classList.remove('dragging');
    this.activeDrag = null;
    if (this.root.hasPointerCapture(drag.pointerId)) this.root.releasePointerCapture(drag.pointerId);
    this.render();
  }
}
