const STORAGE_KEY = 'personal_task_manager_mvp';

const defaultData = {
  version: 1,
  projects: [],
  tasks: [],
  settings: {
    askActualTimeOnComplete: true,
  },
};

const reservedProjectNames = ['входящие'];

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getData() {
  const storedData = localStorage.getItem(STORAGE_KEY);

  if (!storedData) {
    saveData(defaultData);
    return defaultData;
  }

  return JSON.parse(storedData);
}

function normalizeData(data) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const reservedProjectIds = projects
    .filter((project) => isReservedProjectName(project.name))
    .map((project) => project.id);

  return {
    version: data.version || defaultData.version,
    projects: projects.filter((project) => !isReservedProjectName(project.name)),
    tasks: Array.isArray(data.tasks)
      ? data.tasks.map((task) => normalizeTask(task, reservedProjectIds))
      : [],
    settings: {
      ...defaultData.settings,
      ...(data.settings || {}),
    },
  };
}

function normalizeTask(task, reservedProjectIds = []) {
  const now = new Date().toISOString();
  const projectId = reservedProjectIds.includes(task.projectId) ? 'inbox' : task.projectId;

  return {
    id: task.id || String(Date.now()),
    title: task.title || '',
    description: '',
    projectId: 'inbox',
    deadline: null,
    priority: 'medium',
    status: 'active',
    recurrence: 'none',
    estimatedTime: 0,
    actualTime: 0,
    completedAt: null,
    originalTaskId: null,
    createdAt: now,
    updatedAt: now,
    ...task,
    projectId: projectId || task.projectId || 'inbox',
  };
}

let appData = normalizeData(getData());
saveData(appData);
let activeSection = 'сегодня';
let activeProjectId = null;
let searchQuery = '';

const navButtons = document.querySelectorAll('.sidebar__link');
const sectionTitle = document.querySelector('#section-title');
const sectionContent = document.querySelector('#section-content');
const taskSearch = document.querySelector('#task-search');
const addProjectButton = document.querySelector('#add-project-button');
const projectList = document.querySelector('#project-list');
const quickTaskForm = document.querySelector('#quick-task-form');
const quickTaskTitle = document.querySelector('#quick-task-title');
const quickTaskDeadline = document.querySelector('#quick-task-deadline');
const quickTaskPriority = document.querySelector('#quick-task-priority');
const quickTaskRecurrence = document.querySelector('#quick-task-recurrence');
const quickTaskProject = document.querySelector('#quick-task-project');

function getNormalizedProjectName(name) {
  return name.trim().toLowerCase();
}

function isReservedProjectName(name) {
  return reservedProjectNames.includes(getNormalizedProjectName(name));
}

function hasProjectWithName(name, ignoredProjectId = null) {
  const normalizedName = getNormalizedProjectName(name);

  return appData.projects.some((project) => {
    return project.id !== ignoredProjectId && getNormalizedProjectName(project.name) === normalizedName;
  });
}

function createProject(name) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    alert('название проекта не может быть пустым');
    return;
  }

  if (isReservedProjectName(trimmedName)) {
    alert('это системный раздел, его нельзя создать как проект');
    return;
  }

  if (hasProjectWithName(trimmedName)) {
    alert('проект с таким именем уже существует');
    return;
  }

  const now = new Date().toISOString();
  const project = {
    id: String(Date.now()),
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
  };

  appData.projects.push(project);
  saveData(appData);
  renderProjects();
  updateSidebarCounters();
  openProject(project.id);
}

function renameProject(projectId, name) {
  const project = appData.projects.find((item) => item.id === projectId);
  const trimmedName = name.trim();

  if (!project) {
    return;
  }

  if (!trimmedName) {
    alert('название проекта не может быть пустым');
    return;
  }

  if (isReservedProjectName(trimmedName)) {
    alert('это системный раздел, его нельзя использовать как имя проекта');
    return;
  }

  if (hasProjectWithName(trimmedName, projectId)) {
    alert('проект с таким именем уже существует');
    return;
  }

  project.name = trimmedName;
  project.updatedAt = new Date().toISOString();
  saveData(appData);
  renderProjects();
  updateSidebarCounters();
  openProject(projectId);
}

function moveProjectTasksToInbox(projectId) {
  appData.tasks.forEach((task) => {
    if (task.projectId === projectId) {
      task.projectId = 'inbox';
      task.updatedAt = new Date().toISOString();
    }
  });
}

function deleteProject(projectId) {
  const project = appData.projects.find((item) => item.id === projectId);

  if (!project) {
    return;
  }

  const isConfirmed = window.confirm('удалить проект? все активные задачи этого проекта будут перенесены во «входящие».');

  if (!isConfirmed) {
    return;
  }

  moveProjectTasksToInbox(projectId);
  appData.projects = appData.projects.filter((item) => item.id !== projectId);
  saveData(appData);
  activeProjectId = null;
  renderProjects();
  updateSidebarCounters();
  setActiveSection('входящие');
}

function setActiveSection(sectionName) {
  activeSection = sectionName;
  activeProjectId = null;

  navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.section === sectionName);
  });

  projectList.querySelectorAll('.project-list__button').forEach((button) => {
    button.classList.remove('is-active');
  });

  sectionTitle.textContent = sectionName;
  updateSidebarCounters();
  renderCurrentView();
}

function openProject(projectId) {
  const project = appData.projects.find((item) => item.id === projectId);

  if (!project) {
    return;
  }

  activeProjectId = projectId;
  activeSection = 'project';

  navButtons.forEach((button) => {
    button.classList.remove('is-active');
  });

  projectList.querySelectorAll('.project-list__button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.projectId === projectId);
  });

  sectionTitle.textContent = project.name;
  updateSidebarCounters();
  renderCurrentView();
}

function renderProjectActions(project) {
  const actions = document.createElement('div');
  actions.className = 'project-actions';

  const editButton = document.createElement('button');
  editButton.className = 'content__button';
  editButton.type = 'button';
  editButton.textContent = 'переименовать';
  editButton.addEventListener('click', () => {
    const newName = window.prompt('новое имя проекта', project.name);

    if (newName !== null) {
      renameProject(project.id, newName);
    }
  });

  const deleteButton = document.createElement('button');
  deleteButton.className = 'content__button content__button--danger';
  deleteButton.type = 'button';
  deleteButton.textContent = 'удалить';
  deleteButton.addEventListener('click', () => {
    deleteProject(project.id);
  });

  actions.append(editButton, deleteButton);
  sectionContent.append(actions);
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getEndOfToday() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function getDeadlineDate(deadline) {
  if (!deadline) {
    return null;
  }

  if (deadline.includes('T')) {
    return new Date(deadline);
  }

  return new Date(`${deadline}T23:59:59`);
}

function getDeadlineInputValue(deadline) {
  if (!deadline) {
    return '';
  }

  if (deadline.includes('T')) {
    return deadline.slice(0, 16);
  }

  return `${deadline}T23:59`;
}

function formatDeadlineValue(date, originalDeadline) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (!originalDeadline || !originalDeadline.includes('T')) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getNormalizedRecurrence(recurrence) {
  const recurrenceMap = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
  };

  return recurrenceMap[recurrence] || recurrence || 'none';
}

function getRecurrenceLabel(recurrence) {
  const labels = {
    none: '',
    day: 'каждый день',
    week: 'каждую неделю',
    month: 'каждый месяц',
  };

  return labels[getNormalizedRecurrence(recurrence)] || '';
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonthsClamped(date, monthCount) {
  const result = new Date(date);
  const originalDay = result.getDate();
  const targetMonthIndex = result.getMonth() + monthCount;
  const targetYear = result.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedTargetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(originalDay, getDaysInMonth(targetYear, normalizedTargetMonth));

  result.setFullYear(targetYear, normalizedTargetMonth, targetDay);
  return result;
}

function getNextDeadline(deadline, recurrence) {
  const deadlineDate = getDeadlineDate(deadline);

  if (!deadlineDate) {
    return null;
  }

  const normalizedRecurrence = getNormalizedRecurrence(recurrence);
  const nextDate = new Date(deadlineDate);

  if (normalizedRecurrence === 'day') {
    nextDate.setDate(nextDate.getDate() + 1);
    return formatDeadlineValue(nextDate, deadline);
  }

  if (normalizedRecurrence === 'week') {
    nextDate.setDate(nextDate.getDate() + 7);
    return formatDeadlineValue(nextDate, deadline);
  }

  if (normalizedRecurrence === 'month') {
    return formatDeadlineValue(addMonthsClamped(nextDate, 1), deadline);
  }

  return deadline;
}

function getDeadlineGroup(task) {
  const deadlineDate = getDeadlineDate(task.deadline);

  if (!deadlineDate) {
    return 3;
  }

  const startOfToday = getStartOfToday();
  const endOfToday = getEndOfToday();

  if (deadlineDate < startOfToday) {
    return 0;
  }

  if (deadlineDate <= endOfToday) {
    return 1;
  }

  return 2;
}

function getDeadlineGroupTitle(task) {
  const group = getDeadlineGroup(task);

  if (group === 0) {
    return 'просрочено';
  }

  if (group === 1) {
    return 'сегодня';
  }

  if (group === 2) {
    return 'ближайшие';
  }

  return 'без срока';
}

function formatDeadlineLabel(deadline) {
  if (!deadline) {
    return 'без срока';
  }

  const deadlineDate = getDeadlineDate(deadline);

  if (!deadlineDate || Number.isNaN(deadlineDate.getTime())) {
    return deadline;
  }

  const dateText = deadlineDate.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  });

  if (!deadline.includes('T')) {
    return dateText;
  }

  const timeText = deadlineDate.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${dateText}, ${timeText}`;
}

function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getNextSaturday() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilSaturday = day === 6 ? 7 : (6 - day + 7) % 7;

  date.setDate(date.getDate() + daysUntilSaturday);
  date.setHours(12, 0, 0, 0);
  return date;
}

function getPriorityWeight(priority) {
  const weights = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return weights[priority] || weights.medium;
}

function getPriorityLabel(priority) {
  const labels = {
    high: 'важно',
    medium: 'обычно',
    low: 'низко',
  };

  return labels[priority] || labels.medium;
}

function getPriorityClass(priority) {
  const classes = {
    high: 'is-priority-high',
    medium: 'is-priority-medium',
    low: 'is-priority-low',
  };

  return classes[priority] || classes.medium;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sortTasks(tasks) {
  return [...tasks].sort((firstTask, secondTask) => {
    const firstGroup = getDeadlineGroup(firstTask);
    const secondGroup = getDeadlineGroup(secondTask);

    if (firstGroup !== secondGroup) {
      return firstGroup - secondGroup;
    }

    if (firstGroup === 2 && firstTask.deadline !== secondTask.deadline) {
      return firstTask.deadline.localeCompare(secondTask.deadline);
    }

    const priorityDifference = getPriorityWeight(secondTask.priority) - getPriorityWeight(firstTask.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return String(firstTask.createdAt).localeCompare(String(secondTask.createdAt));
  });
}

function getTaskDeadlineStatus(task) {
  const deadlineDate = getDeadlineDate(task.deadline);

  if (!deadlineDate) {
    return '';
  }

  const now = new Date();
  const dayInMs = 24 * 60 * 60 * 1000;

  if (deadlineDate < now) {
    return 'is-overdue';
  }

  if (deadlineDate.getTime() - now.getTime() < dayInMs) {
    return 'is-urgent';
  }

  return '';
}

function getVisibleTasks() {
  if (activeProjectId) {
    return filterTasksBySearch(appData.tasks.filter((task) => task.projectId === activeProjectId && task.status === 'active'));
  }

  if (activeSection === 'сегодня') {
    const endOfToday = getEndOfToday();

    return filterTasksBySearch(appData.tasks.filter((task) => {
      const deadlineDate = getDeadlineDate(task.deadline);
      return task.status === 'active' && deadlineDate && deadlineDate <= endOfToday;
    }));
  }

  if (activeSection === 'входящие') {
    return filterTasksBySearch(appData.tasks.filter((task) => task.projectId === 'inbox' && task.status === 'active' && !task.deadline));
  }

  if (activeSection === 'все задачи') {
    return filterTasksBySearch(appData.tasks.filter((task) => task.status === 'active'));
  }

  if (activeSection === 'без срока') {
    return filterTasksBySearch(appData.tasks.filter((task) => task.status === 'active' && !task.deadline));
  }

  return [];
}

function groupTodayTasks(tasks) {
  return {
    overdue: tasks.filter((task) => getDeadlineDate(task.deadline) < getStartOfToday()),
    today: tasks.filter((task) => {
      const deadlineDate = getDeadlineDate(task.deadline);
      return deadlineDate >= getStartOfToday() && deadlineDate <= getEndOfToday();
    }),
  };
}

function getProjectName(projectId) {
  if (projectId === 'inbox') {
    return 'без проекта';
  }

  const project = appData.projects.find((item) => item.id === projectId);
  return project ? project.name : 'без проекта';
}

function getSearchableTaskText(task) {
  return [
    task.title,
    task.description,
    getProjectName(task.projectId),
  ].join(' ').toLowerCase();
}

function filterTasksBySearch(tasks) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return tasks;
  }

  return tasks.filter((task) => getSearchableTaskText(task).includes(normalizedQuery));
}

function getSectionTaskCount(sectionName) {
  if (sectionName === 'сегодня') {
    const endOfToday = getEndOfToday();
    return appData.tasks.filter((task) => {
      const deadlineDate = getDeadlineDate(task.deadline);
      return task.status === 'active' && deadlineDate && deadlineDate <= endOfToday;
    }).length;
  }

  if (sectionName === 'входящие') {
    return appData.tasks.filter((task) => task.status === 'active' && task.projectId === 'inbox' && !task.deadline).length;
  }

  if (sectionName === 'все задачи') {
    return appData.tasks.filter((task) => task.status === 'active').length;
  }

  if (sectionName === 'без срока') {
    return appData.tasks.filter((task) => task.status === 'active' && !task.deadline).length;
  }

  if (sectionName === 'архив') {
    return appData.tasks.filter((task) => task.status === 'archive').length;
  }

  return null;
}

function updateSidebarCounters() {
  navButtons.forEach((button) => {
    const sectionName = button.dataset.section;
    const count = getSectionTaskCount(sectionName);

    if (count === null) {
      button.textContent = sectionName;
      return;
    }

    button.innerHTML = `<span>${sectionName}</span><span class="sidebar__count">${count}</span>`;
  });
}

function formatTaskText(task) {
  return [
    `Задача: ${task.title}`,
    task.description ? `Описание: ${task.description}` : null,
    task.deadline ? `Дедлайн: ${task.deadline}` : 'Дедлайн: без срока',
    `Приоритет: ${task.priority}`,
    `Проект: ${getProjectName(task.projectId)}`,
    `Статус: ${task.status}`,
    `Затрачено: ${task.actualTime || 0} мин`,
  ].filter(Boolean).join('\n');
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Fall back for file:// pages and browsers without clipboard permission.
  }

  return copyTextWithFallback(text);
}

function copyTextWithFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  const isCopied = document.execCommand('copy');
  textarea.remove();
  return isCopied;
}

async function copyWithButtonFeedback(button, text) {
  const originalText = button.textContent;
  const isCopied = await copyTextToClipboard(text);

  button.textContent = isCopied ? 'скопировано' : 'не удалось';
  button.classList.toggle('is-success', isCopied);
  button.classList.toggle('is-error', !isCopied);

  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('is-success', 'is-error');
  }, 1200);
}

function getBackupFileName() {
  const today = new Date().toISOString().slice(0, 10);
  return `personal-task-manager-backup-${today}.json`;
}

function exportData() {
  const backup = JSON.stringify(appData, null, 2);
  const blob = new Blob([backup], { type: 'application/json' });
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);

  link.href = objectUrl;
  link.download = getBackupFileName();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function isValidImportedData(data) {
  return data && Array.isArray(data.projects) && Array.isArray(data.tasks);
}

function importDataFromFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.addEventListener('load', () => {
    try {
      const parsedData = JSON.parse(reader.result);

      if (!isValidImportedData(parsedData)) {
        alert('ошибка импорта: файл не содержит projects и tasks');
        return;
      }

      const isConfirmed = window.confirm('Импорт заменит все текущие данные. Продолжить?');

      if (!isConfirmed) {
        return;
      }

      saveData(normalizeData(parsedData));
      window.location.reload();
    } catch (error) {
      alert('ошибка импорта: не удалось прочитать json');
    }
  });

  reader.addEventListener('error', () => {
    alert('ошибка импорта: файл не удалось прочитать');
  });

  reader.readAsText(file);
}

function getTodayTasksText() {
  const tasks = sortTasks(getVisibleTasks());
  const groups = groupTodayTasks(tasks);
  const lines = ['Задачи на сегодня'];

  lines.push('', 'Просрочено:');
  lines.push(...formatTasksForCopy(groups.overdue));
  lines.push('', 'На сегодня:');
  lines.push(...formatTasksForCopy(groups.today));

  return lines.join('\n');
}

function formatTasksForCopy(tasks) {
  if (tasks.length === 0) {
    return ['- нет задач'];
  }

  return tasks.map((task) => {
    const deadlineText = task.deadline ? `, дедлайн: ${task.deadline}` : '';
    return `- ${task.title} (${getProjectName(task.projectId)}, ${task.priority}${deadlineText})`;
  });
}

function parseActualTime(value) {
  const minutes = Number(value);

  if (!Number.isFinite(minutes) || minutes < 0) {
    return 0;
  }

  return Math.round(minutes);
}

function completeTask(taskId) {
  const task = appData.tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  const actualTimeInput = appData.settings.askActualTimeOnComplete
    ? window.prompt('введите фактически затраченное время (в минутах):', '0')
    : '0';

  if (actualTimeInput === null) {
    renderCurrentView();
    return;
  }

  const actualTime = parseActualTime(actualTimeInput);
  const now = new Date().toISOString();
  const normalizedRecurrence = getNormalizedRecurrence(task.recurrence);

  if (normalizedRecurrence !== 'none') {
    const archivedTask = {
      ...task,
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      originalTaskId: task.id,
      status: 'archive',
      completedAt: now,
      actualTime,
      updatedAt: now,
    };

    appData.tasks.push(archivedTask);
    task.deadline = getNextDeadline(task.deadline, normalizedRecurrence);
    task.recurrence = normalizedRecurrence;
    task.status = 'active';
    task.actualTime = 0;
    task.completedAt = null;
    task.updatedAt = now;

    saveData(appData);
    updateSidebarCounters();
    renderCurrentView();
    return;
  }

  task.actualTime = actualTime;
  task.completedAt = now;
  task.status = 'archive';
  task.updatedAt = now;

  saveData(appData);
  updateSidebarCounters();
  renderCurrentView();
}

function deleteTask(taskId) {
  const isConfirmed = window.confirm('удалить задачу? это действие нельзя отменить.');

  if (!isConfirmed) {
    return;
  }

  appData.tasks = appData.tasks.filter((task) => task.id !== taskId);
  saveData(appData);
  updateSidebarCounters();
  renderCurrentView();
}

function restoreTask(taskId) {
  const task = appData.tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  task.status = 'active';
  task.completedAt = null;
  task.updatedAt = new Date().toISOString();

  saveData(appData);
  updateSidebarCounters();
  renderCurrentView();
}

function snoozeTask(taskId, mode) {
  const task = appData.tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  const deadline = new Date();

  if (mode === 'tomorrow') {
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(12, 0, 0, 0);
    task.deadline = formatDateTimeLocal(deadline);
  }

  if (mode === 'weekend') {
    task.deadline = formatDateTimeLocal(getNextSaturday());
  }

  if (mode === 'nextWeek') {
    deadline.setDate(deadline.getDate() + 7);
    deadline.setHours(12, 0, 0, 0);
    task.deadline = formatDateTimeLocal(deadline);
  }

  if (mode === 'noDeadline') {
    task.deadline = null;
  }

  task.updatedAt = new Date().toISOString();
  saveData(appData);
  updateSidebarCounters();
  renderCurrentView();
}

function updateTask(taskId, updates) {
  const task = appData.tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  const title = updates.title.trim();

  if (!title) {
    alert('название задачи не может быть пустым');
    return;
  }

  task.title = title;
  task.description = updates.description.trim();
  task.projectId = updates.projectId;
  task.deadline = updates.deadline || null;
  task.priority = updates.priority;
  task.recurrence = getNormalizedRecurrence(updates.recurrence);
  task.estimatedTime = Number(updates.estimatedTime) || 0;
  task.updatedAt = new Date().toISOString();

  saveData(appData);
  updateSidebarCounters();
  renderCurrentView();
}

function renderProjectOptions(selectedProjectId) {
  const options = [
    `<option value="inbox"${selectedProjectId === 'inbox' ? ' selected' : ''}>без проекта</option>`,
  ];

  appData.projects.forEach((project) => {
    const selectedAttribute = project.id === selectedProjectId ? ' selected' : '';
    options.push(`<option value="${escapeHtml(project.id)}"${selectedAttribute}>${escapeHtml(project.name)}</option>`);
  });

  return options.join('');
}

function renderTaskEditForm(task, taskItem) {
  taskItem.innerHTML = `
    <form class="task-edit-form">
      <label class="task-edit-form__field">
        <span>название</span>
        <input name="title" type="text" value="${escapeHtml(task.title)}">
      </label>
      <label class="task-edit-form__field task-edit-form__field--wide">
        <span>описание</span>
        <textarea name="description" rows="3">${escapeHtml(task.description)}</textarea>
      </label>
      <label class="task-edit-form__field">
        <span>проект</span>
        <select name="projectId">${renderProjectOptions(task.projectId)}</select>
      </label>
      <label class="task-edit-form__field">
        <span>дедлайн</span>
        <input name="deadline" type="datetime-local" value="${escapeHtml(getDeadlineInputValue(task.deadline))}">
      </label>
      <label class="task-edit-form__field">
        <span>приоритет</span>
        <select name="priority">
          <option value="low"${task.priority === 'low' ? ' selected' : ''}>низкий</option>
          <option value="medium"${task.priority === 'medium' ? ' selected' : ''}>средний</option>
          <option value="high"${task.priority === 'high' ? ' selected' : ''}>высокий</option>
        </select>
      </label>
      <label class="task-edit-form__field">
        <span>регулярность</span>
        <select name="recurrence">
          <option value="none"${getNormalizedRecurrence(task.recurrence) === 'none' ? ' selected' : ''}>нет</option>
          <option value="day"${getNormalizedRecurrence(task.recurrence) === 'day' ? ' selected' : ''}>ежедневно</option>
          <option value="week"${getNormalizedRecurrence(task.recurrence) === 'week' ? ' selected' : ''}>еженедельно</option>
          <option value="month"${getNormalizedRecurrence(task.recurrence) === 'month' ? ' selected' : ''}>ежемесячно</option>
        </select>
      </label>
      <label class="task-edit-form__field">
        <span>плановое время</span>
        <input name="estimatedTime" type="number" min="0" step="5" value="${escapeHtml(task.estimatedTime || 0)}">
      </label>
      <div class="task-edit-form__actions">
        <button class="content__button" type="submit">сохранить</button>
        <button class="content__button" type="button" data-action="cancel">отмена</button>
      </div>
    </form>
  `;

  const form = taskItem.querySelector('.task-edit-form');
  const cancelButton = taskItem.querySelector('[data-action="cancel"]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    updateTask(task.id, {
      title: formData.get('title'),
      description: formData.get('description'),
      projectId: formData.get('projectId'),
      deadline: formData.get('deadline'),
      priority: formData.get('priority'),
      recurrence: formData.get('recurrence'),
      estimatedTime: formData.get('estimatedTime'),
    });
  });

  cancelButton.addEventListener('click', () => {
    renderCurrentView();
  });
}

function renderTasks() {
  const tasks = sortTasks(getVisibleTasks());

  if (tasks.length === 0) {
    const emptyText = document.createElement('p');
    emptyText.className = 'task-list__empty';
    emptyText.textContent = getEmptyStateText();
    sectionContent.append(emptyText);
    return;
  }

  renderTaskGroups(tasks);
}

function getEmptyStateText() {
  if (activeProjectId) {
    return 'в этом проекте пока нет активных задач';
  }

  if (activeSection === 'входящие') {
    return 'входящие пусты: сюда попадают необработанные задачи без проекта и срока';
  }

  if (activeSection === 'без срока') {
    return 'задач без срока нет: все активные задачи уже имеют дедлайн или проектный контекст';
  }

  if (activeSection === 'все задачи') {
    return 'активных задач пока нет';
  }

  return 'задач пока нет';
}

function renderTaskGroups(tasks) {
  const groups = tasks.reduce((groupMap, task) => {
    const groupTitle = getDeadlineGroupTitle(task);

    if (!groupMap[groupTitle]) {
      groupMap[groupTitle] = [];
    }

    groupMap[groupTitle].push(task);
    return groupMap;
  }, {});

  ['просрочено', 'сегодня', 'ближайшие', 'без срока'].forEach((groupTitle) => {
    if (!groups[groupTitle] || groups[groupTitle].length === 0) {
      return;
    }

    const group = document.createElement('section');
    group.className = 'task-group';

    const heading = document.createElement('h2');
    heading.className = 'task-group__title';
    heading.textContent = groupTitle;

    const taskList = document.createElement('ul');
    taskList.className = 'task-list';

    sortTasks(groups[groupTitle]).forEach((task) => {
      taskList.append(createTaskCard(task));
    });

    group.append(heading, taskList);
    sectionContent.append(group);
  });
}

function createTaskCard(task) {
  const taskItem = document.createElement('li');
  taskItem.className = 'task-list__item';
  taskItem.dataset.taskId = task.id;
  taskItem.classList.add(getPriorityClass(task.priority));

  const deadlineStatus = getTaskDeadlineStatus(task);

  if (deadlineStatus) {
    taskItem.classList.add(deadlineStatus);
  }

  const taskMain = document.createElement('div');
  taskMain.className = 'task-list__main';

  const taskDate = document.createElement('div');
  taskDate.className = 'task-list__date';
  taskDate.textContent = formatDeadlineLabel(task.deadline);

  const taskSchedule = document.createElement('div');
  taskSchedule.className = 'task-list__schedule';

  const completeCheckbox = document.createElement('input');
  completeCheckbox.className = 'task-list__checkbox';
  completeCheckbox.type = 'checkbox';
  completeCheckbox.setAttribute('aria-label', 'выполнить задачу');
  completeCheckbox.addEventListener('change', () => {
    if (completeCheckbox.checked) {
      completeTask(task.id);
    }
  });

  const taskTitle = document.createElement('strong');
  taskTitle.className = 'task-list__title';
  taskTitle.textContent = task.title;

  const taskDescription = document.createElement('p');
  taskDescription.className = 'task-list__description';
  taskDescription.textContent = task.description;

  const taskMeta = document.createElement('span');
  taskMeta.className = 'task-list__meta';
  taskMeta.textContent = [
    `проект: ${getProjectName(task.projectId)}`,
  ].join(' | ');

  const recurrenceLabel = getRecurrenceLabel(task.recurrence);

  if (recurrenceLabel) {
    const recurrenceBadge = document.createElement('span');
    recurrenceBadge.className = 'task-list__recurrence';
    recurrenceBadge.textContent = recurrenceLabel;
    taskMain.append(recurrenceBadge);
  }

  const taskProject = document.createElement('span');
  taskProject.className = 'task-list__project';
  taskProject.textContent = getProjectName(task.projectId);

  const taskPriority = document.createElement('span');
  taskPriority.className = `task-list__priority ${getPriorityClass(task.priority)}`;
  taskPriority.textContent = getPriorityLabel(task.priority);

  const taskActions = document.createElement('details');
  taskActions.className = 'task-list__actions';

  const taskActionsSummary = document.createElement('summary');
  taskActionsSummary.className = 'task-list__actions-trigger';
  taskActionsSummary.textContent = '...';

  const taskActionsMenu = document.createElement('div');
  taskActionsMenu.className = 'task-list__actions-menu';

  taskItem.addEventListener('click', (event) => {
    if (event.target.closest('button, input, summary, details, select, textarea, a')) {
      return;
    }

    renderTaskEditForm(task, taskItem);
  });

  const editButton = document.createElement('button');
  editButton.className = 'content__button';
  editButton.type = 'button';
  editButton.textContent = 'редактировать';
  editButton.addEventListener('click', () => {
    renderTaskEditForm(task, taskItem);
  });

  const copyButton = document.createElement('button');
  copyButton.className = 'content__button content__button--compact';
  copyButton.type = 'button';
  copyButton.textContent = 'скопировать';
  copyButton.addEventListener('click', () => {
    copyWithButtonFeedback(copyButton, formatTaskText(task));
  });

  const deleteButton = document.createElement('button');
  deleteButton.className = 'content__button content__button--danger';
  deleteButton.type = 'button';
  deleteButton.textContent = 'удалить';
  deleteButton.addEventListener('click', () => {
    deleteTask(task.id);
  });

  const tomorrowButton = document.createElement('button');
  tomorrowButton.className = 'content__button';
  tomorrowButton.type = 'button';
  tomorrowButton.textContent = 'завтра';
  tomorrowButton.addEventListener('click', () => {
    snoozeTask(task.id, 'tomorrow');
  });

  const weekendButton = document.createElement('button');
  weekendButton.className = 'content__button';
  weekendButton.type = 'button';
  weekendButton.textContent = 'на выходные';
  weekendButton.addEventListener('click', () => {
    snoozeTask(task.id, 'weekend');
  });

  const nextWeekButton = document.createElement('button');
  nextWeekButton.className = 'content__button';
  nextWeekButton.type = 'button';
  nextWeekButton.textContent = 'через неделю';
  nextWeekButton.addEventListener('click', () => {
    snoozeTask(task.id, 'nextWeek');
  });

  const noDeadlineButton = document.createElement('button');
  noDeadlineButton.className = 'content__button';
  noDeadlineButton.type = 'button';
  noDeadlineButton.textContent = 'без срока';
  noDeadlineButton.addEventListener('click', () => {
    snoozeTask(task.id, 'noDeadline');
  });

  taskActionsMenu.append(tomorrowButton, weekendButton, nextWeekButton, noDeadlineButton, editButton, copyButton, deleteButton);
  taskActions.append(taskActionsSummary, taskActionsMenu);
  taskMain.prepend(taskTitle);
  if (task.description) {
    taskMain.append(taskDescription);
  }
  taskMain.append(taskMeta);
  taskSchedule.append(taskPriority, taskDate);
  taskItem.append(completeCheckbox, taskSchedule, taskMain, taskProject, taskActions);

  return taskItem;
}

function formatArchiveDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'без даты';
  }

  return date.toLocaleDateString('ru-RU');
}

function getArchiveGroups() {
  return filterTasksBySearch(appData.tasks.filter((task) => task.status === 'archive'))
    .sort((firstTask, secondTask) => {
      return String(secondTask.completedAt).localeCompare(String(firstTask.completedAt));
    })
    .reduce((groups, task) => {
      const dateKey = formatArchiveDate(task.completedAt);

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(task);
      return groups;
    }, {});
}

function renderArchiveTasks() {
  const groups = getArchiveGroups();
  const groupEntries = Object.entries(groups);

  if (groupEntries.length === 0) {
    const emptyText = document.createElement('p');
    emptyText.className = 'task-list__empty';
    emptyText.textContent = 'архив пуст: выполненные задачи появятся здесь по датам завершения';
    sectionContent.append(emptyText);
    return;
  }

  groupEntries.forEach(([date, tasks]) => {
    const group = document.createElement('section');
    group.className = 'task-group';

    const heading = document.createElement('h2');
    heading.className = 'task-group__title';
    heading.textContent = date;

    const taskList = document.createElement('ul');
    taskList.className = 'task-list';

    tasks.forEach((task) => {
      taskList.append(createArchiveTaskCard(task));
    });

    group.append(heading, taskList);
    sectionContent.append(group);
  });
}

function renderSettings() {
  const panel = document.createElement('div');
  panel.className = 'settings-panel';

  const timeLabel = document.createElement('label');
  timeLabel.className = 'settings-toggle';

  const timeCheckbox = document.createElement('input');
  timeCheckbox.type = 'checkbox';
  timeCheckbox.checked = appData.settings.askActualTimeOnComplete;
  timeCheckbox.addEventListener('change', () => {
    appData.settings.askActualTimeOnComplete = timeCheckbox.checked;
    saveData(appData);
  });

  const timeText = document.createElement('span');
  timeText.textContent = 'спрашивать затраченное время при выполнении';

  timeLabel.append(timeCheckbox, timeText);

  const exportButton = document.createElement('button');
  exportButton.className = 'content__button';
  exportButton.type = 'button';
  exportButton.textContent = 'экспорт в json';
  exportButton.addEventListener('click', exportData);

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.hidden = true;
  importInput.addEventListener('change', () => {
    importDataFromFile(importInput.files[0]);
    importInput.value = '';
  });

  const importButton = document.createElement('button');
  importButton.className = 'content__button';
  importButton.type = 'button';
  importButton.textContent = 'импорт из json';
  importButton.addEventListener('click', () => {
    importInput.click();
  });

  panel.append(timeLabel, exportButton, importButton, importInput);
  sectionContent.append(panel);
}

function createArchiveTaskCard(task) {
  const taskItem = document.createElement('li');
  taskItem.className = 'task-list__item task-list__item--archive';
  taskItem.dataset.taskId = task.id;

  const taskMain = document.createElement('div');
  taskMain.className = 'task-list__main';

  const taskTitle = document.createElement('strong');
  taskTitle.className = 'task-list__title';
  taskTitle.textContent = task.title;

  const taskMeta = document.createElement('span');
  taskMeta.className = 'task-list__meta';
  taskMeta.textContent = [
    `затрачено: ${task.actualTime || 0} мин`,
    `проект: ${getProjectName(task.projectId)}`,
  ].join(' | ');

  const taskProject = document.createElement('span');
  taskProject.className = 'task-list__project';
  taskProject.textContent = getProjectName(task.projectId);

  const taskActions = document.createElement('details');
  taskActions.className = 'task-list__actions';

  const taskActionsSummary = document.createElement('summary');
  taskActionsSummary.className = 'task-list__actions-trigger';
  taskActionsSummary.textContent = '...';

  const taskActionsMenu = document.createElement('div');
  taskActionsMenu.className = 'task-list__actions-menu';

  const restoreButton = document.createElement('button');
  restoreButton.className = 'content__button';
  restoreButton.type = 'button';
  restoreButton.textContent = 'восстановить';
  restoreButton.addEventListener('click', () => {
    restoreTask(task.id);
  });

  const copyButton = document.createElement('button');
  copyButton.className = 'content__button content__button--compact';
  copyButton.type = 'button';
  copyButton.textContent = 'скопировать';
  copyButton.addEventListener('click', () => {
    copyWithButtonFeedback(copyButton, formatTaskText(task));
  });

  taskActionsMenu.append(restoreButton, copyButton);
  taskActions.append(taskActionsSummary, taskActionsMenu);
  taskMain.append(taskTitle, taskMeta);
  taskItem.append(taskMain, taskProject, taskActions);

  return taskItem;
}

function renderTodayTasks() {
  const tasks = sortTasks(getVisibleTasks());
  renderTodayActions();

  if (tasks.length === 0) {
    const emptyText = document.createElement('p');
    emptyText.className = 'task-list__empty';
    emptyText.textContent = 'на сегодня задач нет: можно разобрать входящие или добавить новую задачу';
    sectionContent.append(emptyText);
    return;
  }

  const groups = groupTodayTasks(tasks);
  renderTodayGroup('просрочено', groups.overdue);
  renderTodayBlock(groups.today);
}

function renderTodayActions() {
  const actions = document.createElement('div');
  actions.className = 'view-actions';

  const copyButton = document.createElement('button');
  copyButton.className = 'content__button';
  copyButton.type = 'button';
  copyButton.textContent = 'скопировать список задач на сегодня';
  copyButton.addEventListener('click', () => {
    copyWithButtonFeedback(copyButton, getTodayTasksText());
  });

  actions.append(copyButton);
  sectionContent.append(actions);
}

function renderTodayGroup(title, tasks) {
  if (tasks.length === 0) {
    return;
  }

  const group = document.createElement('section');
  group.className = 'task-group';

  const heading = document.createElement('h2');
  heading.className = 'task-group__title';
  heading.textContent = title;

  const taskList = document.createElement('ul');
  taskList.className = 'task-list';

  sortTasks(tasks).forEach((task) => {
    taskList.append(createTaskCard(task));
  });

  group.append(heading, taskList);
  sectionContent.append(group);
}

function renderTodayBlock(tasks) {
  if (tasks.length === 0) {
    return;
  }

  const block = document.createElement('section');
  block.className = 'task-group task-group--today';

  const heading = document.createElement('h2');
  heading.className = 'task-group__title';
  heading.textContent = 'сегодня';

  block.append(heading);
  sectionContent.append(block);
  renderTodayPriorityGroupsInto(block, tasks);
}

function renderTodayPriorityGroupsInto(container, tasks) {
  const priorityGroups = [
    ['важное', tasks.filter((task) => task.priority === 'high'), 'is-priority-high'],
    ['обычное', tasks.filter((task) => task.priority === 'medium' || !task.priority), 'is-priority-medium'],
    ['низкий приоритет', tasks.filter((task) => task.priority === 'low'), 'is-priority-low'],
  ];

  priorityGroups.forEach(([title, groupTasks, priorityClass]) => {
    renderTodaySubgroup(title, groupTasks, priorityClass, container);
  });
}

function renderTodaySubgroup(title, tasks, priorityClass, container = sectionContent) {
  if (tasks.length === 0) {
    return;
  }

  const subgroup = document.createElement('section');
  subgroup.className = 'task-subgroup';

  const heading = document.createElement('h3');
  heading.className = `task-subgroup__title ${priorityClass}`;
  heading.textContent = title;

  const taskList = document.createElement('ul');
  taskList.className = 'task-list';

  sortTasks(tasks).forEach((task) => {
    taskList.append(createTaskCard(task));
  });

  subgroup.append(heading, taskList);
  container.append(subgroup);
}

function refreshDeadlineClasses() {
  sectionContent.querySelectorAll('.task-list__item[data-task-id]').forEach((taskItem) => {
    const task = appData.tasks.find((item) => item.id === taskItem.dataset.taskId);

    if (!task) {
      return;
    }

    taskItem.classList.remove('is-overdue', 'is-urgent');

    const deadlineStatus = getTaskDeadlineStatus(task);

    if (deadlineStatus) {
      taskItem.classList.add(deadlineStatus);
    }
  });
}

function renderCurrentView() {
  sectionContent.innerHTML = '';

  if (activeProjectId) {
    const project = appData.projects.find((item) => item.id === activeProjectId);

    if (project) {
      renderProjectActions(project);
    }
  }

  if (activeSection === 'настройки') {
    renderSettings();
  } else if (activeSection === 'сегодня' && !activeProjectId) {
    renderTodayTasks();
  } else if (activeSection === 'архив') {
    renderArchiveTasks();
  } else {
    renderTasks();
  }
}

function renderProjects() {
  projectList.innerHTML = '';

  appData.projects.forEach((project) => {
    const projectButton = document.createElement('button');
    projectButton.className = 'project-list__button';
    projectButton.type = 'button';
    projectButton.dataset.projectId = project.id;
    projectButton.textContent = project.name;
    projectButton.classList.toggle('is-active', project.id === activeProjectId);
    projectButton.addEventListener('click', () => {
      openProject(project.id);
    });

    projectList.append(projectButton);
  });

  renderProjectSelectOptions();
}

function renderProjectSelectOptions() {
  const selectedProjectId = quickTaskProject.value;

  quickTaskProject.innerHTML = '<option value="">проект</option>';

  appData.projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    quickTaskProject.append(option);
  });

  if (appData.projects.some((project) => project.id === selectedProjectId)) {
    quickTaskProject.value = selectedProjectId;
  }
}

function getTaskProjectId() {
  if (activeProjectId) {
    return activeProjectId;
  }

  if (quickTaskProject.value) {
    return quickTaskProject.value;
  }

  if (activeSection === 'входящие' || activeSection === 'сегодня') {
    return 'inbox';
  }

  return 'inbox';
}

function createTask(title) {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    alert('название задачи не может быть пустым');
    return;
  }

  const now = new Date().toISOString();
  const task = {
    id: String(Date.now()),
    title: trimmedTitle,
    projectId: getTaskProjectId(),
    deadline: quickTaskDeadline.value || null,
    description: '',
    priority: quickTaskPriority.value,
    status: 'active',
    recurrence: quickTaskRecurrence.value,
    estimatedTime: 0,
    actualTime: 0,
    completedAt: null,
    originalTaskId: null,
    createdAt: now,
    updatedAt: now,
  };

  appData.tasks.push(task);
  saveData(appData);
  updateSidebarCounters();
  quickTaskForm.reset();
  quickTaskPriority.value = 'medium';
  quickTaskRecurrence.value = 'none';
  renderCurrentView();
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveSection(button.dataset.section);
  });
});

taskSearch.addEventListener('input', () => {
  searchQuery = taskSearch.value;
  renderCurrentView();
});

addProjectButton.addEventListener('click', () => {
  const projectName = window.prompt('название проекта');

  if (projectName !== null) {
    createProject(projectName);
  }
});

quickTaskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  createTask(quickTaskTitle.value);
});

renderProjects();
setActiveSection('сегодня');
setInterval(refreshDeadlineClasses, 60000);
