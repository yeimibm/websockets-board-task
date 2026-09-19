import type { Participant } from '../models/board';

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export function participantsList(participants: Participant[], currentUserId?: string): string {
  if (!participants.length) return '<p class="empty-copy">Nobody is here yet.</p>';
  return participants.map((participant) => `
    <div class="participant-row">
      <span class="avatar" style="background:${participant.color}">${initials(participant.name)}</span>
      <span class="min-w-0"><strong>${escapeHtml(participant.name)}${participant.id === currentUserId ? ' <em>(you)</em>' : ''}</strong><small><i></i>${participant.connected === false ? 'Offline' : 'Online'}</small></span>
    </div>`).join('');
}

export function avatarStack(participants: Participant[]): string {
  const visible = participants.slice(0, 4).map((participant) =>
    `<span class="avatar avatar-small" title="${escapeHtml(participant.name)}" style="background:${participant.color}">${initials(participant.name)}</span>`,
  ).join('');
  const overflow = participants.length > 4 ? `<span class="avatar avatar-small avatar-overflow" title="${participants.length - 4} more collaborators">+${participants.length - 4}</span>` : '';
  return visible + overflow;
}

export function escapeHtml(value: string): string {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}
