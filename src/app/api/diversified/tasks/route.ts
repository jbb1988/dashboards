import { NextRequest, NextResponse } from 'next/server';
import {
  listTasks,
  listSections,
  createTask,
  updateTask,
  calculateTaskStats,
  getSubtasks,
  AsanaTask,
} from '@/lib/asana';

export const dynamic = 'force-dynamic';

// Diversified project ID from Asana
const DIVERSIFIED_PROJECT_ID = process.env.ASANA_DIVERSIFIED_PROJECT_ID || '';

// Cache
let cachedData: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Map Asana sections to priority (based on section names like "Urgent", "High Priority", etc.)
function getPriorityFromSection(sectionName: string): 'urgent' | 'high' | 'medium' | 'low' {
  const lower = sectionName.toLowerCase();
  if (lower.includes('urgent') || lower.includes('critical')) return 'urgent';
  if (lower.includes('high')) return 'high';
  if (lower.includes('medium') || lower.includes('normal')) return 'medium';
  if (lower.includes('low')) return 'low';
  return 'medium'; // default
}

// Map priority to a status (based on whether task is in progress section)
function getStatusFromTask(task: AsanaTask): 'pending' | 'in_progress' | 'completed' {
  if (task.completed) return 'completed';
  const section = task.memberships?.[0]?.section?.name?.toLowerCase() || '';
  if (section.includes('progress') || section.includes('doing') || section.includes('active')) {
    return 'in_progress';
  }
  return 'pending';
}

// GET - Fetch all tasks from Asana Diversified project
export async function GET(request: NextRequest) {
  try {
    if (!DIVERSIFIED_PROJECT_ID) {
      return NextResponse.json({
        error: 'Asana not configured',
        message: 'ASANA_DIVERSIFIED_PROJECT_ID environment variable not set',
        tasks: [],
        summary: { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, urgent: 0, high: 0 },
      });
    }

    const { searchParams } = new URL(request.url);
    const bust = searchParams.get('bust') === 'true';
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    // Check cache
    const now = Date.now();
    if (!bust && cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData.data);
    }

    // Fetch sections to map priorities
    const sections = await listSections(DIVERSIFIED_PROJECT_ID);
    const sectionMap = new Map(sections.map(s => [s.gid, s.name]));

    // Fetch tasks from Asana
    const asanaTasks = await listTasks(DIVERSIFIED_PROJECT_ID, {
      completedSince: includeCompleted ? undefined : 'now',
    });

    // Fetch subtasks for all tasks in parallel
    const subtasksMap = new Map<string, AsanaTask[]>();
    const subtaskPromises = asanaTasks.map(async (task) => {
      try {
        const subtasks = await getSubtasks(task.gid);
        subtasksMap.set(task.gid, subtasks);
      } catch (err) {
        console.error(`Error fetching subtasks for task ${task.gid}:`, err);
        subtasksMap.set(task.gid, []);
      }
    });
    await Promise.all(subtaskPromises);

    // Transform Asana tasks to our format (including subtasks)
    const tasks = asanaTasks.map(task => {
      const sectionGid = task.memberships?.[0]?.section?.gid;
      const sectionName = sectionGid ? sectionMap.get(sectionGid) || 'No Section' : 'No Section';
      const taskSubtasks = subtasksMap.get(task.gid) || [];

      return {
        id: task.gid,
        title: task.name,
        description: task.notes || '',
        customer_id: null, // Could be extracted from tags or custom fields
        customer_name: null,
        priority: getPriorityFromSection(sectionName),
        status: getStatusFromTask(task),
        due_date: task.due_on || null,
        assignee_email: task.assignee?.email || null,
        assignee_name: task.assignee?.name || null,
        source: 'asana' as const,
        insight_id: null,
        section: sectionName,
        section_gid: sectionGid || null,
        created_at: task.created_at || new Date().toISOString(),
        updated_at: task.modified_at || new Date().toISOString(),
        asana_gid: task.gid,
        // Include subtasks
        subtasks: taskSubtasks.map(st => ({
          id: st.gid,
          title: st.name,
          completed: st.completed,
          due_date: st.due_on || null,
          assignee_name: st.assignee?.name || null,
        })),
        subtask_count: taskSubtasks.length,
        subtasks_completed: taskSubtasks.filter(st => st.completed).length,
      };
    });

    // Calculate summary stats
    const stats = calculateTaskStats(asanaTasks);
    const summary = {
      total: stats.total,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: stats.completed,
      overdue: stats.overdue,
      urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length,
      high: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
    };

    const responseData = {
      tasks,
      sections: sections.map(s => ({ gid: s.gid, name: s.name })),
      summary,
      source: 'asana',
      projectId: DIVERSIFIED_PROJECT_ID,
    };

    // Cache result
    cachedData = { data: responseData, timestamp: now };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching tasks from Asana:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
        tasks: [],
        summary: { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, urgent: 0, high: 0 },
      },
      { status: 500 }
    );
  }
}

// POST - Create a new task in Asana
export async function POST(request: NextRequest) {
  try {
    if (!DIVERSIFIED_PROJECT_ID) {
      return NextResponse.json(
        { error: 'Asana not configured', message: 'ASANA_DIVERSIFIED_PROJECT_ID not set' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, description, due_date, assignee, section, priority } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // If priority is specified but no section, try to find a section that matches
    let sectionGid = section;
    if (!sectionGid && priority) {
      const sections = await listSections(DIVERSIFIED_PROJECT_ID);
      const matchingSection = sections.find(s => {
        const lower = s.name.toLowerCase();
        switch (priority) {
          case 'urgent': return lower.includes('urgent') || lower.includes('critical');
          case 'high': return lower.includes('high');
          case 'medium': return lower.includes('medium') || lower.includes('normal');
          case 'low': return lower.includes('low');
          default: return false;
        }
      });
      if (matchingSection) {
        sectionGid = matchingSection.gid;
      }
    }

    // Create task in Asana
    const createdTask = await createTask(DIVERSIFIED_PROJECT_ID, {
      name: title,
      notes: description || undefined,
      due_on: due_date || undefined,
      assignee: assignee || undefined,
      section: sectionGid || undefined,
    });

    // Invalidate cache
    cachedData = null;

    return NextResponse.json({
      task: {
        id: createdTask.gid,
        title: createdTask.name,
        description: createdTask.notes || '',
        asana_gid: createdTask.gid,
      },
    });
  } catch (error) {
    console.error('Error creating task in Asana:', error);
    return NextResponse.json(
      { error: 'Failed to create task', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Update a task in Asana
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, completed, title, due_date, assignee, notes, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Build updates object
    const updates: {
      completed?: boolean;
      name?: string;
      due_on?: string | null;
      assignee?: string | null;
      notes?: string;
    } = {};

    if (completed !== undefined) updates.completed = completed;
    if (title !== undefined) updates.name = title;
    if (due_date !== undefined) updates.due_on = due_date;
    if (assignee !== undefined) updates.assignee = assignee;
    if (notes !== undefined) updates.notes = notes;

    // Handle status change - if marking as completed
    if (status === 'completed') {
      updates.completed = true;
    }

    const updatedTask = await updateTask(id, updates);

    // Invalidate cache
    cachedData = null;

    return NextResponse.json({
      task: {
        id: updatedTask.gid,
        title: updatedTask.name,
        completed: updatedTask.completed,
        asana_gid: updatedTask.gid,
      },
    });
  } catch (error) {
    console.error('Error updating task in Asana:', error);
    return NextResponse.json(
      { error: 'Failed to update task', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Mark task as completed in Asana (we don't actually delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Mark as completed instead of deleting
    await updateTask(taskId, { completed: true });

    // Invalidate cache
    cachedData = null;

    return NextResponse.json({ success: true, message: 'Task marked as completed' });
  } catch (error) {
    console.error('Error completing task in Asana:', error);
    return NextResponse.json(
      { error: 'Failed to complete task', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
