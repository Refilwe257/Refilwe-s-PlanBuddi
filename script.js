const STORAGE_KEY = 'planbuddi-tasks';
const TEAM_MEMBER_KEY = 'planbuddi-team-member';
const elements = { list: document.querySelector('#taskList'), empty: document.querySelector('#emptyState'), modal: document.querySelector('#taskModal'), form: document.querySelector('#taskForm'), filter: document.querySelector('#taskFilter'), toast: document.querySelector('#toast'), calendar: document.querySelector('#calendarBody'), unscheduled: document.querySelector('#unscheduledTasks') };
let tasks = loadTasks();
let editingId = null;
let toastTimer;
const priorityOrder = { high: 0, medium: 1, low: 2 };

function dateToIso(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function todayIso() { return dateToIso(new Date()); }
function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved.map(task => ({ duration: 60, assigned: '', notes: '', ...task }));
  } catch { /* A corrupt local entry should not stop the planner. */ }
  const today = todayIso();
  return [
    { id: 'sample-1', name: 'Review quarterly reports', description: 'Check the figures and prepare discussion points.', date: today, duration: 90, priority: 'high', assigned: 'You', notes: '', completed: false },
    { id: 'sample-2', name: 'Team stand-up', description: 'Share progress, blockers, and next steps.', date: today, duration: 30, priority: 'medium', assigned: 'You', notes: '', completed: false },
    { id: 'sample-3', name: 'Update onboarding checklist', description: '', date: today, duration: 45, priority: 'low', assigned: 'You', notes: '', completed: false }
  ];
}
function createTaskId() { return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function formatDate(dateString) { return dateString ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${dateString}T12:00:00`)) : 'No date'; }
function formatDay(dateString) { return new Intl.DateTimeFormat('en-ZA', { weekday: 'short' }).format(new Date(`${dateString}T12:00:00`)); }
function formatTime(timeString) { if (!timeString) return ''; const [hours, minutes] = timeString.split(':'); const date = new Date(); date.setHours(Number(hours), Number(minutes)); return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date); }
function clockLabel(minutes) { const date = new Date(); date.setHours(Math.floor(minutes / 60), minutes % 60); return formatTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2800); }

function getPlanningMode() { return document.querySelector('input[name="planningMode"]:checked').value; }

function render() {
  const filter = elements.filter.value;
  const visibleTasks = tasks.filter(task => filter === 'all' || (filter === 'completed' ? task.completed : !task.completed));
  document.querySelector('#totalTasks').textContent = tasks.length;
  document.querySelector('#completedTasks').textContent = tasks.filter(task => task.completed).length;
  document.querySelector('#pendingTasks').textContent = tasks.filter(task => !task.completed).length;
  document.querySelector('#taskCount').textContent = `(${visibleTasks.length})`;
  const completed = tasks.filter(task => task.completed).length;
  document.querySelector('#completionRate').textContent = `${tasks.length ? Math.round((completed / tasks.length) * 100) : 0}% done`;
  elements.empty.hidden = visibleTasks.length !== 0;
  elements.list.innerHTML = visibleTasks.map((task, index) => `<article class="task-item priority-${escapeHtml(task.priority)} ${task.completed ? 'is-complete' : ''}" style="animation-delay:${index * 40}ms"><input class="task-check" type="checkbox" ${task.completed ? 'checked' : ''} data-action="complete" data-id="${task.id}" aria-label="Mark ${escapeHtml(task.name)} as complete"><div class="task-content"><h3>${escapeHtml(task.name)}</h3>${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}<div class="task-meta"><span>◷ ${formatDate(task.date)} · ${task.duration} min${task.assigned ? ` · ${escapeHtml(task.assigned)}` : ''}</span><span class="priority-badge ${escapeHtml(task.priority)}">${escapeHtml(task.priority)} priority</span></div></div><div class="task-actions"><button class="icon-button" type="button" data-action="edit" data-id="${task.id}" aria-label="Edit ${escapeHtml(task.name)}">✎</button><button class="icon-button" type="button" data-action="delete" data-id="${task.id}" aria-label="Delete ${escapeHtml(task.name)}">⌫</button></div></article>`).join('');
}

function openModal(task = null) {
  editingId = task ? task.id : null;
  document.querySelector('#modalTitle').textContent = task ? 'Edit task' : 'Add a task';
  elements.form.reset();
  if (task) {
    Object.entries({ taskName: task.name, taskDescription: task.description, taskDate: task.date, taskDuration: task.duration, taskPriority: task.priority, taskAssigned: task.assigned, taskNotes: task.notes }).forEach(([id, value]) => { document.querySelector(`#${id}`).value = value || ''; });
  } else document.querySelector('#taskDate').value = todayIso();
  elements.modal.hidden = false;
  document.querySelector('#taskName').focus();
}
function closeModal() { elements.modal.hidden = true; editingId = null; elements.form.reset(); }

function generateSchedule() {
  if (!tasks.length) return showToast('Add at least one task before generating a schedule.');
  const start = document.querySelector('#workStart').value;
  const end = document.querySelector('#workEnd').value;
  if (!start || !end || start >= end) return showToast('Choose valid working hours before generating.');
  const startMinutes = Number(start.split(':')[0]) * 60 + Number(start.split(':')[1]);
  const endMinutes = Number(end.split(':')[0]) * 60 + Number(end.split(':')[1]);
  const period = document.querySelector('#planningPeriod').value;
  const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  const baseDate = new Date(`${todayIso()}T12:00:00`);
  const schedules = new Map();
  const scheduled = [];
  const unscheduled = [];
  [...tasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.date.localeCompare(b.date) || a.duration - b.duration).forEach(task => {
    let placed = false;
    for (let day = 0; day < days && !placed; day += 1) {
      const candidateDate = new Date(baseDate); candidateDate.setDate(baseDate.getDate() + day);
      const date = dateToIso(candidateDate);
      let cursor = schedules.get(date) || startMinutes;
      const deadlineDate = new Date(`${task.date}T23:59:59`);
      if (candidateDate > deadlineDate || cursor + Number(task.duration) > endMinutes) continue;
      const taskStart = cursor;
      const taskEnd = taskStart + Number(task.duration);
      schedules.set(date, taskEnd + (taskEnd + 10 <= endMinutes ? 10 : 0));
      scheduled.push({ task, date, start: taskStart, end: taskEnd });
      placed = true;
    }
    if (!placed) unscheduled.push(task);
  });
  elements.calendar.innerHTML = scheduled.length ? scheduled.map(item => `<tr><td>${formatDay(item.date)}</td><td>${formatDate(item.date)}</td><td>${clockLabel(item.start)} – ${clockLabel(item.end)}</td><td><strong>${escapeHtml(item.task.name)}</strong></td><td><span class="status-pill ${item.task.completed ? 'completed' : 'pending'}">${item.task.completed ? 'Completed' : 'Pending'}</span></td><td><span class="priority-pill ${escapeHtml(item.task.priority)}">${escapeHtml(item.task.priority)}</span></td><td>${formatDate(item.task.date)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No tasks fit within this planning window.</td></tr>';
  elements.unscheduled.hidden = !unscheduled.length;
  elements.unscheduled.innerHTML = unscheduled.length ? `<strong>${unscheduled.length} task${unscheduled.length === 1 ? '' : 's'} need attention</strong><ul>${unscheduled.map(task => `<li>${escapeHtml(task.name)} (${task.duration} min) could not fit before ${formatDate(task.date)}.</li>`).join('')}</ul>` : '';
  const member = document.querySelector('#teamMember').value.trim();
  document.querySelector('#scheduleSummary').textContent = `${scheduled.length} task${scheduled.length === 1 ? '' : 's'} planned for ${period} hours${member ? ` for ${member}` : ''}. Review the suggestions before acting on them.`;
  document.querySelector('#scheduleGeneratedAt').textContent = `Generated ${new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`;
  window.currentSchedule = scheduled;
  showToast(`${scheduled.length} task${scheduled.length === 1 ? '' : 's'} scheduled.`);
}

document.querySelector('#headerDate').textContent = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
document.querySelector('#teamMember').value = localStorage.getItem(TEAM_MEMBER_KEY) || '';
document.querySelector('#teamMember').addEventListener('input', event => localStorage.setItem(TEAM_MEMBER_KEY, event.target.value));
document.querySelectorAll('[data-open-modal]').forEach(button => button.addEventListener('click', () => openModal()));
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
elements.modal.addEventListener('click', event => { if (event.target === elements.modal) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !elements.modal.hidden) closeModal(); });
elements.filter.addEventListener('change', render);
document.querySelectorAll('input[name="planningMode"]').forEach(input => input.addEventListener('change', event => { document.querySelectorAll('.choice-card').forEach(card => card.classList.toggle('active', card.querySelector('input').checked)); const isTeam = event.target.value === 'team'; document.querySelector('#memberField').hidden = !isTeam; document.querySelector('#setupStatus').textContent = isTeam ? 'Team plan' : 'Personal plan'; }));
document.querySelector('#generateSchedule').addEventListener('click', generateSchedule);
document.querySelector('#taskForm').addEventListener('submit', event => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const duration = Number(formData.get('taskDuration'));
  if (!duration || duration < 15) return showToast('Estimated duration must be at least 15 minutes.');
  const savedTeamMember = document.querySelector('#teamMember').value.trim();
  const defaultAssignee = getPlanningMode() === 'team' && savedTeamMember ? savedTeamMember : 'You';
  const data = { name: formData.get('taskName').trim(), description: formData.get('taskDescription').trim(), date: formData.get('taskDate'), duration, priority: formData.get('taskPriority'), assigned: formData.get('taskAssigned').trim() || defaultAssignee, notes: formData.get('taskNotes').trim() };
  if (editingId) { const task = tasks.find(item => item.id === editingId); Object.assign(task, data); showToast('Task updated.'); } else { tasks.unshift({ id: createTaskId(), ...data, completed: false }); showToast('Task saved to your plan.'); }
  saveTasks(); render(); closeModal();
});
elements.list.addEventListener('click', event => { const control = event.target.closest('[data-action]'); if (!control) return; const task = tasks.find(item => item.id === control.dataset.id); if (!task) return; if (control.dataset.action === 'edit') openModal(task); if (control.dataset.action === 'delete') { tasks = tasks.filter(item => item.id !== task.id); saveTasks(); render(); showToast('Task removed.'); } });
elements.list.addEventListener('change', event => { const control = event.target.closest('[data-action="complete"]'); if (!control) return; const task = tasks.find(item => item.id === control.dataset.id); if (!task) return; task.completed = control.checked; saveTasks(); render(); showToast(task.completed ? 'Nice work. Task completed.' : 'Task moved back to pending.'); });
document.querySelector('#shareSchedule').addEventListener('click', async () => { if (!window.currentSchedule?.length) return showToast('Generate a schedule before sharing.'); const text = `PlanBuddi AI schedule: ${window.currentSchedule.map(item => `${item.task.name} at ${clockLabel(item.start)}`).join(', ')}`; try { await navigator.clipboard.writeText(text); showToast('Schedule summary copied to clipboard.'); } catch { showToast('Schedule ready to share from your calendar.'); } });
document.querySelector('#downloadSchedule').addEventListener('click', async () => {
  if (!window.currentSchedule?.length) return showToast('Generate a schedule before downloading.');
  if (!window.html2canvas || !window.jspdf) return showToast('PDF tools are still loading. Please try again.');
  const schedule = document.querySelector('#scheduleCapture');
  const actions = schedule.querySelector('.schedule-actions');
  actions.style.visibility = 'hidden';
  try {
    const canvas = await window.html2canvas(schedule, { scale: 2, backgroundColor: '#fbfaf5', useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const portrait = canvas.width < canvas.height;
    const pdf = new jsPDF({ orientation: portrait ? 'portrait' : 'landscape', unit: 'pt', format: 'a4' });
    const margin = 24;
    const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
    const pixelsPerPage = Math.floor(canvas.width * pageHeight / pageWidth);
    let offset = 0;
    let page = 0;
    while (offset < canvas.height) {
      const sliceHeight = Math.min(pixelsPerPage, canvas.height - offset);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      slice.getContext('2d').drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      if (page) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, pageWidth, sliceHeight * pageWidth / canvas.width, undefined, 'FAST');
      offset += sliceHeight;
      page += 1;
    }
    pdf.save(`planbuddy-schedule-${todayIso()}.pdf`);
    showToast('Schedule PDF downloaded.');
  } catch (error) {
    console.error('Schedule PDF export failed:', error);
    showToast('The schedule could not be exported. Please try again.');
  } finally {
    actions.style.visibility = '';
  }
});
document.querySelector('#chatForm').addEventListener('submit', event => { event.preventDefault(); const input = document.querySelector('#chatInput'); const value = input.value.trim(); if (!value) return; const log = document.querySelector('#chatLog'); log.insertAdjacentHTML('beforeend', `<div class="chat-bubble user">${escapeHtml(value)}</div>`); let response = 'I can suggest changes locally. Try “regenerate my schedule” or “which task should I complete first?”.'; if (/first|priority/i.test(value) && tasks.length) { const first = [...tasks].filter(task => !task.completed).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.date.localeCompare(b.date))[0]; response = first ? `Start with “${first.name}” because it is the strongest priority in your current plan.` : 'All current tasks are complete.'; } if (/regenerate|schedule|tomorrow/i.test(value)) { generateSchedule(); response = /tomorrow/i.test(value) ? 'I cannot move tasks automatically in this demo, but you can edit a deadline and regenerate the schedule.' : 'I regenerated the schedule using your current planning settings.'; } log.insertAdjacentHTML('beforeend', `<div class="chat-bubble">${escapeHtml(response)}</div>`); input.value = ''; log.scrollTop = log.scrollHeight; });
render();
