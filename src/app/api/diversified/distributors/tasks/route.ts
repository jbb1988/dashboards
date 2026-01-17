import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// DEPRECATED: This endpoint is replaced by /api/diversified/tasks
// All new task creation should use the Asana integration
// This endpoint remains for backward compatibility only

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.warn('DEPRECATED: /api/diversified/distributors/tasks GET endpoint used. Migrate to /api/diversified/tasks');

  try {
    const admin = getSupabaseAdmin();

    // Fetch all distributor tasks
    const { data: tasks, error } = await admin
      .from('distributor_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate summary metrics
    const now = new Date();
    const summary = {
      total: tasks?.length || 0,
      pending: tasks?.filter(t => t.status === 'pending').length || 0,
      in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
      completed: tasks?.filter(t => t.status === 'completed').length || 0,
      overdue: tasks?.filter(t => {
        if (!t.due_date || t.status === 'completed') return false;
        return new Date(t.due_date) < now;
      }).length || 0,
      urgent: tasks?.filter(t => t.priority === 'urgent').length || 0,
    };

    return NextResponse.json({
      tasks: tasks || [],
      summary,
    });

  } catch (error) {
    console.error('Error fetching distributor tasks:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
        tasks: [],
        summary: {
          total: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          overdue: 0,
          urgent: 0,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.warn('DEPRECATED: /api/diversified/distributors/tasks POST endpoint used. Migrate to /api/diversified/tasks');

  try {
    const admin = getSupabaseAdmin();
    const body = await request.json();

    // Handle bulk task creation from insights
    if (Array.isArray(body)) {
      const tasksToCreate = body.map(task => ({
        title: task.title,
        description: task.description || null,
        distributor_name: task.distributor_name || null,
        customer_id: task.customer_id || null,
        customer_name: task.customer_name || null,
        location: task.location || null,
        priority: task.priority || 'medium',
        status: 'pending',
        source: task.source || 'manual',
        insight_id: task.insight_id || null,
        due_date: task.due_date || null,
        assignee_email: task.assignee_email || null,
        assignee_name: task.assignee_name || null,
      }));

      const { data, error } = await admin
        .from('distributor_tasks')
        .insert(tasksToCreate)
        .select();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        tasks: data,
        count: data?.length || 0,
      });
    }

    // Single task creation
    const { data, error } = await admin
      .from('distributor_tasks')
      .insert({
        title: body.title,
        description: body.description || null,
        distributor_name: body.distributor_name || null,
        customer_id: body.customer_id || null,
        customer_name: body.customer_name || null,
        location: body.location || null,
        priority: body.priority || 'medium',
        status: body.status || 'pending',
        source: body.source || 'manual',
        insight_id: body.insight_id || null,
        due_date: body.due_date || null,
        assignee_email: body.assignee_email || null,
        assignee_name: body.assignee_name || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      task: data,
    });

  } catch (error) {
    console.error('Error creating distributor task:', error);
    return NextResponse.json(
      {
        error: 'Failed to create task',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  console.warn('DEPRECATED: /api/diversified/distributors/tasks PATCH endpoint used. Migrate to /api/diversified/tasks');

  try {
    const admin = getSupabaseAdmin();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const updates: any = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.due_date !== undefined) updates.due_date = body.due_date;
    if (body.assignee_email !== undefined) updates.assignee_email = body.assignee_email;
    if (body.assignee_name !== undefined) updates.assignee_name = body.assignee_name;

    const { data, error } = await admin
      .from('distributor_tasks')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      task: data,
    });

  } catch (error) {
    console.error('Error updating distributor task:', error);
    return NextResponse.json(
      {
        error: 'Failed to update task',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.warn('DEPRECATED: /api/diversified/distributors/tasks DELETE endpoint used. Migrate to /api/diversified/tasks');

  try {
    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from('distributor_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting distributor task:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete task',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
