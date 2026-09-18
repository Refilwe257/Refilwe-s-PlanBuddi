const markerWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
const markerNodes = [];
while (markerWalker.nextNode()) if (markerWalker.currentNode.nodeValue.trim() === '+') markerNodes.push(markerWalker.currentNode);
markerNodes.forEach(node => node.remove());
const $ = id => document.getElementById(id);
const userNameElement = document.querySelector('.user span');
const userAvatarElement = document.querySelector('.user .avatar');
const savedUserName = localStorage.getItem('planbuddi-user-name') || userNameElement.textContent.trim();
userNameElement.textContent = savedUserName;
userAvatarElement.textContent = savedUserName.split(/\s+/).map(name => name[0]).slice(0, 2).join('').toUpperCase();
const editUserButton = document.createElement('button');
editUserButton.type = 'button';
editUserButton.className = 'icon-btn';
editUserButton.setAttribute('aria-label', 'Edit user name');
editUserButton.textContent = 'Edit';
const userNameInput = document.createElement('input');
userNameInput.className = 'input';
userNameInput.value = savedUserName;
userNameInput.setAttribute('aria-label', 'User name');
userNameInput.style.display = 'none';
userNameInput.style.width = '150px';
const saveUserButton = document.createElement('button');
saveUserButton.type = 'button';
saveUserButton.className = 'btn btn-main';
saveUserButton.textContent = 'Save';
saveUserButton.style.display = 'none';
saveUserButton.onclick = () => {
  const cleanName = userNameInput.value.trim();
  if (!cleanName) return;
  localStorage.setItem('planbuddi-user-name', cleanName);
  userNameElement.textContent = cleanName;
  userAvatarElement.textContent = cleanName.split(/\s+/).map(value => value[0]).slice(0, 2).join('').toUpperCase();
  userNameInput.style.display = 'none';
  saveUserButton.style.display = 'none';
  editUserButton.style.display = '';
};
editUserButton.onclick = () => { userNameInput.style.display = ''; saveUserButton.style.display = ''; editUserButton.style.display = 'none'; userNameInput.focus(); };
document.querySelector('.user').append(userNameInput, saveUserButton, editUserButton);
const editAssignedLabel = document.createElement('label');
editAssignedLabel.className = 'field-label';
editAssignedLabel.style.marginTop = '14px';
editAssignedLabel.innerHTML = 'Assigned person<input class="input" id="editAssigned" placeholder="Who owns this task?">';
$('editDeadline').parentElement.before(editAssignedLabel);
const today = new Date();
const iso = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmt = date => new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
const escapeHtml = value => String(value).replace(/[&<>\'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
let priority = 'high';
let tasks = [
  { id: 1, name: 'Review quarterly reports', deadline: iso(today), duration: 90, priority: 'high', assigned: 'Innocent' },
  { id: 2, name: 'Team stand-up', deadline: iso(today), duration: 30, priority: 'medium', assigned: 'Innocent' },
  { id: 3, name: 'Update onboarding checklist', deadline: iso(today), duration: 60, priority: 'low', assigned: 'Innocent' }
];
let lastSchedule = [];
const toast = message => { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); };
function renderTasks() {
  $('taskCount').textContent = `(${tasks.length})`;
  $('taskList').innerHTML = tasks.length ? tasks.map(task => `<article class="task-card ${task.priority}"><div class="task-card-top"><span class="task-name">${escapeHtml(task.name)}</span><span class="badge ${task.priority}">${task.priority}</span></div><div class="task-meta">${task.duration} min · due ${fmt(task.deadline)} · ${escapeHtml(task.assigned || 'Unassigned')}</div><div class="task-actions"><button class="icon-btn" onclick="editTask(${task.id})">Edit</button><button class="icon-btn btn-danger" onclick="deleteTask(${task.id})">Delete</button></div></article>`).join('') : '<div class="empty">No tasks yet. Add your first task.</div>';
}
function minutes(time) { const [hours, mins] = time.split(':').map(Number); return hours * 60 + mins; }
function timeLabel(value) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
function generateSchedule() {
  const start = $('startTime').value, end = $('endTime').value;
  if (!tasks.length) return toast('Add at least one task first.');
  if (!start || !end || start >= end) return toast('Please choose valid working hours.');
  const order = { high: 0, medium: 1, low: 2 }, scheduled = [], unscheduled = [];
  let cursor = minutes(start), finish = minutes(end);
  [...tasks].sort((a, b) => order[a.priority] - order[b.priority] || a.deadline.localeCompare(b.deadline)).forEach(task => {
    if (cursor + task.duration <= finish) { scheduled.push({ ...task, start: cursor, end: cursor + task.duration }); cursor += task.duration; if (cursor + 10 < finish) cursor += 10; } else unscheduled.push(task);
  });
  lastSchedule = scheduled;
  $('scheduleSummary').textContent = `${scheduled.length} task${scheduled.length === 1 ? '' : 's'} planned between ${start} and ${end}, ordered by priority and deadline.`;
  $('calendarBody').innerHTML = scheduled.length ? scheduled.map(task => `<tr><td class="date-cell"><strong>${new Intl.DateTimeFormat('en-ZA', { weekday: 'short' }).format(new Date(`${task.deadline}T12:00:00`))}</strong><span>${fmt(task.deadline)}</span></td><td>${timeLabel(task.start)} – ${timeLabel(task.end)}<br><span style="color:var(--muted);font-size:11px">${task.duration} min</span></td><td class="task-cell"><strong>${escapeHtml(task.name)}</strong><span style="color:var(--muted);font-size:11px">${escapeHtml(task.assigned)}</span></td><td><span class="badge ${task.priority}">${task.priority}</span></td><td>${fmt(task.deadline)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No tasks fit inside these working hours.</td></tr>';
  $('unscheduled').innerHTML = unscheduled.length ? `<div class="unscheduled"><h3>⚠ ${unscheduled.length} task${unscheduled.length === 1 ? '' : 's'} need attention</h3><ul>${unscheduled.map(task => `<li><strong>${escapeHtml(task.name)}</strong> could not fit within ${start}–${end} (${task.duration} min).</li>`).join('')}</ul></div>` : '';
  toast(`${scheduled.length} task${scheduled.length === 1 ? '' : 's'} scheduled successfully.`);
}
function clearForm() { ['taskName', 'description', 'deadline', 'duration', 'notes'].forEach(id => $(id).value = ''); setPriority('high'); }
function setPriority(value) { priority = value; document.querySelectorAll('.priority').forEach(button => button.classList.toggle('active', button.dataset.priority === value)); }
window.deleteTask = id => {
  tasks = tasks.filter(task => task.id !== id);
  renderTasks();
  if (tasks.length) {
    generateSchedule();
  } else {
    lastSchedule = [];
    $('scheduleSummary').textContent = 'Add tasks and generate a schedule to see your day.';
    $('calendarBody').innerHTML = '<tr><td colspan="5" class="empty">Your generated calendar will appear here.</td></tr>';
    $('unscheduled').innerHTML = '';
    toast('Task removed and schedule cleared.');
  }
};
window.editTask = id => { const task = tasks.find(item => item.id === id); $('editId').value = id; $('editName').value = task.name; $('editAssigned').value = task.assigned || ''; $('editDeadline').value = task.deadline; $('editDuration').value = task.duration; $('editModal').classList.add('open'); };
$('saveEdit').onclick = () => { const task = tasks.find(item => item.id === Number($('editId').value)); task.name = $('editName').value.trim() || task.name; task.assigned = $('editAssigned').value.trim() || 'Unassigned'; task.deadline = $('editDeadline').value || task.deadline; task.duration = Number($('editDuration').value) || task.duration; $('editModal').classList.remove('open'); renderTasks(); generateSchedule(); toast('Task updated and schedule refreshed.'); };
$('cancelEdit').onclick = () => $('editModal').classList.remove('open');
document.querySelectorAll('.priority').forEach(button => button.onclick = () => setPriority(button.dataset.priority));
document.querySelectorAll('.period').forEach(button => button.onclick = () => { document.querySelectorAll('.period').forEach(item => item.classList.remove('active')); button.classList.add('active'); });
$('clearForm').onclick = clearForm;
$('addTask').onclick = () => { const name = $('taskName').value.trim(), deadline = $('deadline').value, duration = Number($('duration').value); if (!name || !deadline || !duration || duration < 15) return toast('Please add a task name, deadline, and duration of 15+ minutes.'); tasks.push({ id: Date.now(), name, deadline, duration, priority, assigned: $('assigned').value || 'Unassigned' }); renderTasks(); clearForm(); toast('Task added to your inbox.'); };
$('generate').onclick = generateSchedule;
function pdfEscape(value) { return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, ''); }
function buildSchedulePdf() {
  const lines = ['PLANBUDDI AI SCHEDULE', `Generated ${new Date().toLocaleDateString('en-ZA')}`, '', 'TIME          TASK                                      PRIORITY   DEADLINE'];
  lastSchedule.forEach(task => lines.push(`${timeLabel(task.start)}-${timeLabel(task.end).padEnd(11)} ${task.name.slice(0, 40).padEnd(41)} ${task.priority.padEnd(10)} ${task.deadline}`));
  const content = ['BT', '/F1 16 Tf', '50 750 Td', ...lines.map((line, index) => `${index ? '0 -22 Td' : ''} (${pdfEscape(line)}) Tj`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
$('download').onclick = async () => {
  if (!lastSchedule.length) return toast('Generate a schedule before downloading.');
  if (!window.html2canvas || !window.jspdf) return toast('PDF tools are still loading. Please try again.');
  const schedule = $('schedule'), actions = schedule.querySelector('.schedule-actions');
  actions.style.visibility = 'hidden';
  try {
    const canvas = await window.html2canvas(schedule, { scale: 2, backgroundColor: '#f5f8f6', useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 24, pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const imageHeight = canvas.height * pageWidth / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, pageWidth, imageHeight, undefined, 'FAST');
    pdf.save('planbuddi-schedule.pdf');
    toast('Screen-matched PDF downloaded.');
  } finally {
    actions.style.visibility = '';
  }
};
$('share').onclick = async () => { try { await navigator.clipboard.writeText('My PlanBuddi AI schedule is ready for review.'); toast('Share note copied to clipboard.'); } catch { toast('Your schedule is ready to share.'); } };
$('chatForm').onsubmit = event => { event.preventDefault(); const input = $('chatInput'), value = input.value.trim(); if (!value) return; const log = $('chatLog'); log.innerHTML += `<div class="bubble user">${escapeHtml(value)}</div>`; let response = 'I can help with that. Generate the schedule after making your changes.'; if (/first|priority/i.test(value)) response = `Start with “${[...tasks].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))[0].name}” because it has the highest priority.`; if (/regenerate|again/i.test(value)) { generateSchedule(); response = 'I regenerated the schedule using your current tasks and working hours.'; } if (/add a task/i.test(value)) { $('taskName').focus(); response = 'The task form is ready. Add details and select Add task.'; } log.innerHTML += `<div class="bubble">${escapeHtml(response)}</div>`; input.value = ''; log.scrollTop = log.scrollHeight; };
renderTasks();
generateSchedule();
