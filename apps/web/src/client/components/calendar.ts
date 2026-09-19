export function calendar(selected = ''): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first }, () => '<span></span>');
  for (let day = 1; day <= days; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push(`<button class="calendar-day ${selected === iso ? 'selected' : ''} ${day === today.getDate() ? 'today' : ''}" data-date="${iso}">${day}</button>`);
  }
  return `<section class="calendar-card">
    <div class="calendar-heading"><strong>${today.toLocaleString('en', { month: 'long' })}</strong><span>${year}</span></div>
    <div class="calendar-grid weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
    <div class="calendar-grid">${cells.join('')}</div>
    ${selected ? '<button class="clear-date" data-clear-date>Clear date</button>' : ''}
  </section>`;
}
