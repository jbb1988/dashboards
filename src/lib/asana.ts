/**
 * Asana API Client
 * Fetches projects, tasks, and custom fields from Asana
 */

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

// Type definitions
export interface AsanaWorkspace {
  gid: string;
  name: string;
  resource_type: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  resource_type: string;
  archived?: boolean;
  color?: string;
  created_at?: string;
  modified_at?: string;
  notes?: string;
  public?: boolean;
  workspace?: {
    gid: string;
    name: string;
  };
  team?: {
    gid: string;
    name: string;
  };
}

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  resource_type: string;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  type: string;
  display_value?: string;
  number_value?: number;
  text_value?: string;
  enum_value?: {
    gid: string;
    name: string;
    color: string;
  };
  date_value?: {
    date: string;
    date_time?: string;
  };
}

export interface AsanaTask {
  gid: string;
  name: string;
  resource_type: string;
  completed: boolean;
  completed_at?: string;
  created_at?: string;
  due_on?: string;
  due_at?: string;
  start_on?: string;
  start_at?: string;
  modified_at?: string;
  notes?: string;
  assignee?: AsanaUser;
  assignee_status?: string;
  custom_fields?: AsanaCustomField[];
  memberships?: Array<{
    project: {
      gid: string;
      name: string;
    };
    section?: {
      gid: string;
      name: string;
    };
  }>;
  parent?: {
    gid: string;
    name: string;
  };
  projects?: Array<{
    gid: string;
    name: string;
  }>;
  tags?: Array<{
    gid: string;
    name: string;
    color: string;
  }>;
}

export interface AsanaSection {
  gid: string;
  name: string;
  resource_type: string;
}

// API Response types
interface AsanaResponse<T> {
  data: T;
  next_page?: {
    offset: string;
    path: string;
    uri: string;
  };
}

// Helper to get auth headers
function getHeaders(): HeadersInit {
  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) {
    throw new Error('ASANA_ACCESS_TOKEN not configured');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// Generic fetch helper with pagination support
async function asanaFetch<T>(
  endpoint: string,
  options: { allPages?: boolean } = {}
): Promise<T> {
  const url = `${ASANA_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Asana API error (${response.status}): ${error}`);
  }

  const result: AsanaResponse<T> = await response.json();

  // Handle pagination for array results
  if (options.allPages && result.next_page && Array.isArray(result.data)) {
    let allData = [...result.data] as unknown as T[];
    let nextPage: { offset: string; path: string; uri: string } | undefined = result.next_page;

    while (nextPage) {
      const pageResponse = await fetch(nextPage.uri, {
        headers: getHeaders(),
      });

      if (!pageResponse.ok) break;

      const pageResult: AsanaResponse<T[]> = await pageResponse.json();
      allData = [...allData, ...pageResult.data];
      nextPage = pageResult.next_page;
    }

    return allData as unknown as T;
  }

  return result.data;
}

// Workspace functions
export async function listWorkspaces(): Promise<AsanaWorkspace[]> {
  return asanaFetch<AsanaWorkspace[]>('/workspaces', { allPages: true });
}

// Project functions
export async function listProjects(workspaceId?: string): Promise<AsanaProject[]> {
  const wsId = workspaceId || process.env.ASANA_WORKSPACE_ID;
  if (!wsId) {
    throw new Error('Workspace ID not provided and ASANA_WORKSPACE_ID not configured');
  }

  const fields = 'gid,name,archived,color,created_at,modified_at,notes,public,workspace,team';
  return asanaFetch<AsanaProject[]>(
    `/workspaces/${wsId}/projects?opt_fields=${fields}&archived=false`,
    { allPages: true }
  );
}

export async function getProject(projectId: string): Promise<AsanaProject> {
  const fields = 'gid,name,archived,color,created_at,modified_at,notes,public,workspace,team';
  return asanaFetch<AsanaProject>(`/projects/${projectId}?opt_fields=${fields}`);
}

// Section functions
export async function listSections(projectId: string): Promise<AsanaSection[]> {
  return asanaFetch<AsanaSection[]>(`/projects/${projectId}/sections`, { allPages: true });
}

// Task functions
export async function listTasks(
  projectId: string,
  options: {
    completedSince?: string;
    modifiedSince?: string;
    section?: string;
  } = {}
): Promise<AsanaTask[]> {
  const fields = [
    'gid', 'name', 'completed', 'completed_at', 'created_at',
    'due_on', 'due_at', 'start_on', 'start_at', 'modified_at',
    'notes', 'assignee', 'assignee.name', 'assignee.email',
    'custom_fields', 'memberships', 'memberships.section',
    'projects', 'tags'
  ].join(',');

  let endpoint = `/projects/${projectId}/tasks?opt_fields=${fields}`;

  if (options.completedSince) {
    endpoint += `&completed_since=${options.completedSince}`;
  }
  if (options.modifiedSince) {
    endpoint += `&modified_since=${options.modifiedSince}`;
  }

  const tasks = await asanaFetch<AsanaTask[]>(endpoint, { allPages: true });

  // Filter by section if specified
  if (options.section) {
    return tasks.filter(task =>
      task.memberships?.some(m => m.section?.gid === options.section)
    );
  }

  return tasks;
}

export async function getTask(taskId: string): Promise<AsanaTask> {
  const fields = [
    'gid', 'name', 'completed', 'completed_at', 'created_at',
    'due_on', 'due_at', 'start_on', 'start_at', 'modified_at',
    'notes', 'assignee', 'assignee.name', 'assignee.email',
    'custom_fields', 'memberships', 'memberships.section',
    'parent', 'projects', 'tags'
  ].join(',');

  return asanaFetch<AsanaTask>(`/tasks/${taskId}?opt_fields=${fields}`);
}

// Get subtasks for a task
export async function getSubtasks(taskId: string): Promise<AsanaTask[]> {
  const fields = [
    'gid', 'name', 'completed', 'completed_at', 'due_on', 'assignee', 'assignee.name'
  ].join(',');

  return asanaFetch<AsanaTask[]>(`/tasks/${taskId}/subtasks?opt_fields=${fields}`, { allPages: true });
}

// Create a new task in a project
export async function createTask(
  projectId: string,
  task: {
    name: string;
    notes?: string;
    due_on?: string | null;
    assignee?: string | null;
    section?: string; // section gid
  }
): Promise<AsanaTask> {
  const url = `${ASANA_BASE_URL}/tasks`;

  const taskData: Record<string, unknown> = {
    name: task.name,
    projects: [projectId],
  };

  if (task.notes) taskData.notes = task.notes;
  if (task.due_on) taskData.due_on = task.due_on;
  if (task.assignee) taskData.assignee = task.assignee;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ data: taskData }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Asana API error (${response.status}): ${error}`);
  }

  const result = await response.json();
  const createdTask = result.data as AsanaTask;

  // If section is specified, move task to that section
  if (task.section) {
    await addTaskToSection(createdTask.gid, task.section);
  }

  return createdTask;
}

// Add a task to a section
export async function addTaskToSection(
  taskId: string,
  sectionId: string
): Promise<void> {
  const url = `${ASANA_BASE_URL}/sections/${sectionId}/addTask`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ data: { task: taskId } }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Asana API error (${response.status}): ${error}`);
  }
}

// Update task (e.g., mark as complete)
export async function updateTask(
  taskId: string,
  updates: {
    completed?: boolean;
    name?: string;
    due_on?: string | null;
    start_on?: string | null;
    notes?: string;
    assignee?: string | null;
  }
): Promise<AsanaTask> {
  const url = `${ASANA_BASE_URL}/tasks/${taskId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ data: updates }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Asana API error (${response.status}): ${error}`);
  }

  const result = await response.json();
  return result.data;
}

// Delete a task (works for subtasks too)
export async function deleteTask(taskId: string): Promise<void> {
  const url = `${ASANA_BASE_URL}/tasks/${taskId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Asana API error (${response.status}): ${error}`);
  }
}

// Helper to extract custom field value
export function getCustomFieldValue(
  task: AsanaTask,
  fieldName: string
): string | number | null {
  const field = task.custom_fields?.find(
    f => f.name.toLowerCase() === fieldName.toLowerCase()
  );

  if (!field) return null;

  switch (field.type) {
    case 'text':
      return field.text_value || null;
    case 'number':
      return field.number_value ?? null;
    case 'enum':
      return field.enum_value?.name || null;
    case 'date':
      return field.date_value?.date || null;
    default:
      return field.display_value || null;
  }
}

// Helper to group tasks by section
export function groupTasksBySection(
  tasks: AsanaTask[]
): Record<string, AsanaTask[]> {
  const groups: Record<string, AsanaTask[]> = {
    'No Section': [],
  };

  for (const task of tasks) {
    const section = task.memberships?.[0]?.section?.name || 'No Section';
    if (!groups[section]) {
      groups[section] = [];
    }
    groups[section].push(task);
  }

  return groups;
}

// Helper to calculate task stats
export function calculateTaskStats(tasks: AsanaTask[]): {
  total: number;
  completed: number;
  incomplete: number;
  overdue: number;
  dueSoon: number;
  unassigned: number;
} {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  return {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    incomplete: tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => {
      if (t.completed || !t.due_on) return false;
      return new Date(t.due_on) < now;
    }).length,
    dueSoon: tasks.filter(t => {
      if (t.completed || !t.due_on) return false;
      const dueDate = new Date(t.due_on);
      return dueDate >= now && dueDate <= threeDaysFromNow;
    }).length,
    unassigned: tasks.filter(t => !t.completed && !t.assignee).length,
  };
}
