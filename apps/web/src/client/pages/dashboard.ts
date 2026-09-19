import { normalizeRoomId, roomPath } from '@collab/websocket-protocol';
import { calendar } from '../components/calendar';
import { projectFolder } from '../components/project-folder';
import type { Project } from '../models/project';

const STORAGE_KEY = 'collab-projects';

function loadProjects(): Project[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Project[]; }
  catch { return []; }
}

function saveProjects(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function navigate(roomId: string, name: string): void {
  sessionStorage.setItem(`identity:${roomId}`, name);
  history.pushState({}, '', roomPath(roomId));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function dashboardPage(root: HTMLElement, notice?: string): () => void {
  const controller = new AbortController();
  let projects = loadProjects();
  let query = '';
  let date = '';
  root.innerHTML = `
    <main class="dashboard-shell">
      <aside class="dashboard-sidebar">
        <a class="brand" href="/" data-home><span>◇</span><strong>Canvas Rooms</strong></a>
        <nav><a class="active">▦ Projects</a><a>☆ Favorites</a><a>◷ Recent</a></nav>
        <div id="calendar"></div>
        <section class="sidebar-help"><strong>Collaborate live</strong><p>Share a room ID and create together in real time.</p></section>
      </aside>
      <section class="dashboard-content">
        ${notice ? `<div class="dashboard-notice" role="alert">${notice}</div>` : ''}
        <header class="dashboard-header"><div><p class="eyebrow">Workspace</p><h1>My projects</h1><p>Organize ideas, diagrams, and tasks with your team.</p></div><button class="primary-button" data-new>＋ New project</button></header>
        <div class="filters"><label class="search-box"><span>⌕</span><input type="search" placeholder="Search projects" data-search /></label><button class="secondary-button" data-join>Join with room ID</button></div>
        <div class="project-grid" id="projects"></div>
      </section>
    </main>
    <dialog class="modal" id="project-dialog"><form method="dialog" id="project-form">
      <button class="modal-close" value="cancel" aria-label="Close">×</button><p class="eyebrow" id="dialog-eyebrow">New room</p><h2 id="dialog-title">Create a project</h2>
      <label><span id="project-name-label">Project name</span><input name="projectName" maxlength="60" required placeholder="Architecture map" /></label>
      <p class="field-error" id="room-error" role="alert"></p>
      <label>Your name<input name="userName" maxlength="40" required placeholder="Yeimi" /></label>
      <button class="primary-button" value="default">Continue</button>
    </form></dialog>`;

  const grid = root.querySelector<HTMLElement>('#projects')!;
  const calendarRoot = root.querySelector<HTMLElement>('#calendar')!;
  const dialog = root.querySelector<HTMLDialogElement>('#project-dialog')!;
  const form = root.querySelector<HTMLFormElement>('#project-form')!;
  const roomError = root.querySelector<HTMLElement>('#room-error')!;
  let mode: 'create' | 'join' | 'open' = 'create';
  let targetRoom = '';

  const render = (): void => {
    calendarRoot.innerHTML = calendar(date);
    const filtered = projects.filter((project) => project.name.toLowerCase().includes(query) && (!date || project.updatedAt.startsWith(date)));
    grid.innerHTML = filtered.length ? filtered.map(projectFolder).join('') : `<div class="empty-projects"><span>▱</span><h2>No projects found</h2><p>Create a room or adjust your filters.</p></div>`;
  };

  const openDialog = (nextMode: typeof mode, room = ''): void => {
    mode = nextMode; targetRoom = room; form.reset(); roomError.textContent = '';
    const projectInput = form.elements.namedItem('projectName') as HTMLInputElement;
    const titles = {
      create: { eyebrow: 'New room', title: 'Create a project', label: 'Project name', placeholder: 'Architecture map' },
      join: { eyebrow: 'Existing room', title: 'Join a project', label: 'Room ID', placeholder: 'room-demo' },
      open: { eyebrow: 'Welcome back', title: 'Enter this project', label: 'Project', placeholder: '' },
    };
    const values = titles[mode];
    root.querySelector('#dialog-eyebrow')!.textContent = values.eyebrow; root.querySelector('#dialog-title')!.textContent = values.title; root.querySelector('#project-name-label')!.textContent = values.label; projectInput.placeholder = values.placeholder;
    projectInput.maxLength = mode === 'join' ? 300 : 60;
    projectInput.value = mode === 'open' ? projects.find((item) => item.roomId === room)?.name ?? room : '';
    projectInput.disabled = mode === 'open'; dialog.showModal();
  };

  root.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).matches('[data-search]')) { query = (event.target as HTMLInputElement).value.trim().toLowerCase(); render(); }
  }, { signal: controller.signal });
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-new]')) openDialog('create');
    else if (target.closest('[data-join]')) openDialog('join');
    else if (target.closest('[data-project]')) openDialog('open', target.closest<HTMLElement>('[data-project]')!.dataset.project!);
    else if (target.closest('[data-date]')) { date = target.closest<HTMLElement>('[data-date]')!.dataset.date!; render(); }
    else if (target.closest('[data-clear-date]')) { date = ''; render(); }
  }, { signal: controller.signal });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form); const userName = String(data.get('userName') ?? '').trim();
    if (!userName) return;
    if (mode === 'create') {
      const name = String(data.get('projectName') ?? '').trim(); if (!name) return;
      const roomId = `room-${crypto.randomUUID().slice(0, 8)}`; const now = new Date().toISOString();
      projects = [{ id: roomId, name, roomId, createdAt: now, updatedAt: now, status: 'active', participants: [userName] }, ...projects];
      saveProjects(projects); dialog.close(); navigate(roomId, userName);
    } else {
      const roomId = normalizeRoomId(mode === 'join' ? String(data.get('projectName') ?? '') : targetRoom);
      if (!roomId) {
        roomError.textContent = 'Enter a valid room ID or paste a shared board link.';
        (form.elements.namedItem('projectName') as HTMLInputElement).focus();
        return;
      }
      if (!projects.some((item) => item.roomId === roomId)) {
        const now = new Date().toISOString(); projects.unshift({ id: roomId, name: roomId, roomId, createdAt: now, updatedAt: now, status: 'active', participants: [userName] }); saveProjects(projects);
      }
      dialog.close(); navigate(roomId, userName);
    }
  }, { signal: controller.signal });
  render();
  return () => controller.abort();
}
