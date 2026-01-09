import { NextRequest, NextResponse } from 'next/server';
import { getTasks, createTask, Task } from '@/lib/supabase';

/**
 * GET - Fetch tasks, optionally filtered by contract name
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractName = searchParams.get('contractName');

    let tasks: Task[];

    if (contractName) {
      // Get tasks for a specific contract by name
      tasks = await getTasks({ contractName });
    } else {
      // Get all tasks
      tasks = await getTasks();
    }

    // Transform to match frontend expectations
    const transformedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status === 'completed' ? 'Done' : task.status === 'in_progress' ? 'In Progress' : 'To Do',
      dueDate: task.due_date || null,
      priority: task.priority,
      assignee: task.assignee_email || null,
      contractName: task.contract_name,
      completed: task.status === 'completed',
    }));

    return NextResponse.json({ tasks: transformedTasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

/**
 * POST - Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractName, title, dueDate } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const newTask = await createTask({
      title,
      contract_name: contractName || undefined,
      due_date: dueDate || undefined,
      status: 'pending',
      priority: 'medium',
      is_auto_generated: false,
    });

    if (!newTask) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId: newTask.id,
      task: {
        id: newTask.id,
        title: newTask.title,
        status: 'To Do',
        dueDate: newTask.due_date || null,
        priority: newTask.priority,
        contractName: newTask.contract_name,
      },
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
