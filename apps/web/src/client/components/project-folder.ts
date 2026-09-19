import type { Project } from '../models/project';
import { escapeHtml } from './participants';

export function projectFolder(project: Project): string {
  const date = new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<button class="project-folder" data-project="${escapeHtml(project.id)}">
    <span class="folder-tab"></span>
    <span class="folder-icon" aria-hidden="true">▰</span>
    <strong>${escapeHtml(project.name)}</strong>
    <span class="room-code">${escapeHtml(project.roomId)}</span>
    <span class="folder-meta"><span>${project.participants.length} collaborators</span><span>${date}</span></span>
  </button>`;
}
