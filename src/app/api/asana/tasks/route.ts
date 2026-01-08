import { NextRequest, NextResponse } from 'next/server';
import {
  listTasks,
  listSections,
  getProject,
  groupTasksBySection,
  calculateTaskStats,
  AsanaTask,
} from '@/lib/asana';

export const dynamic = 'force-dynamic';

// In-memory cache
let cachedData: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const bust = searchParams.get('bust') === 'true';
    const groupBy = searchParams.get('groupBy'); // 'section' | 'assignee' | 'status'
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    if (!projectId) {
      return NextResponse.json({
        error: 'Missing projectId',
        message: 'Please provide a projectId query parameter',
      }, { status: 400 });
    }

    // Check cache
    const cacheKey = `tasks-${projectId}-${includeCompleted}`;
    const now = Date.now();
    if (!bust && cachedData[cacheKey] && (now - cachedData[cacheKey].timestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData[cacheKey].data);
    }

    // Fetch project info
    const project = await getProject(projectId);

    // Fetch sections
    const sections = await listSections(projectId);

    // Fetch tasks
    let tasks = await listTasks(projectId, {
      completedSince: includeCompleted ? undefined : 'now',
    });

    // Calculate stats
    const stats = calculateTaskStats(tasks);

    // Group tasks if requested
    let groupedTasks: Record<string, AsanaTask[]> | null = null;
    if (groupBy === 'section') {
      groupedTasks = groupTasksBySection(tasks);
    }

    // Transform tasks for response
    const transformedTasks = tasks.map(task => ({
      gid: task.gid,
      name: task.name,
      completed: task.completed,
      completedAt: task.completed_at,
      dueOn: task.due_on,
      startOn: task.start_on,
      assignee: task.assignee ? {
        gid: task.assignee.gid,
        name: task.assignee.name,
        email: task.assignee.email,
      } : null,
      section: task.memberships?.[0]?.section?.name || null,
      tags: task.tags?.map(t => ({ name: t.name, color: t.color })) || [],
      customFields: task.custom_fields?.map(cf => ({
        name: cf.name,
        value: cf.display_value || cf.text_value || cf.number_value || cf.enum_value?.name || null,
        type: cf.type,
      })) || [],
      notes: task.notes?.substring(0, 500) || null,
      createdAt: task.created_at,
      modifiedAt: task.modified_at,
    }));

    const responseData = {
      project: {
        gid: project.gid,
        name: project.name,
        color: project.color,
      },
      sections: sections.map(s => ({
        gid: s.gid,
        name: s.name,
      })),
      tasks: transformedTasks,
      groupedTasks: groupedTasks ? Object.fromEntries(
        Object.entries(groupedTasks).map(([section, sectionTasks]) => [
          section,
          sectionTasks.map(t => ({
            gid: t.gid,
            name: t.name,
            completed: t.completed,
            dueOn: t.due_on,
            assignee: t.assignee?.name || null,
          }))
        ])
      ) : null,
      stats,
      count: tasks.length,
      lastUpdated: new Date().toISOString(),
    };

    // Cache result
    cachedData[cacheKey] = { data: responseData, timestamp: now };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching Asana tasks:', error);
    return NextResponse.json({
      error: 'Failed to fetch tasks',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
