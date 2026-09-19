import type { Tool } from '../models/board';

const tools: Array<{ id: Tool; icon: string; label: string }> = [
  { id: 'select', icon: '↖', label: 'Select' },
  { id: 'block', icon: '▭', label: 'Block' },
  { id: 'connect', icon: '↗', label: 'Connect' },
  { id: 'edit', icon: '✎', label: 'Edit' },
  { id: 'delete', icon: '⌫', label: 'Delete' },
];

export function boardToolbar(active: Tool, editable: boolean): string {
  return `<div class="toolbar" role="toolbar" aria-label="Board tools">
    ${tools.map((tool) => `<button class="tool-button ${active === tool.id ? 'active' : ''}" data-tool="${tool.id}" ${editable ? '' : 'disabled'} title="${tool.label}">
      <span aria-hidden="true">${tool.icon}</span><span>${tool.label}</span>
    </button>`).join('')}
  </div>`;
}
