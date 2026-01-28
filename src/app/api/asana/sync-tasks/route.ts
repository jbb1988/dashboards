import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { listProjects, listTasks, AsanaTask } from '@/lib/asana';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for sync

/**
 * Asana Tasks Sync API
 * Syncs Asana tasks to local cache for fast global search
 *
 * POST /api/asana/sync-tasks
 * Body: {
 *   projectIds?: string[]   // Optional: specific projects to sync (default: all projects)
 *   fullSync?: boolean      // Optional: force full sync ignoring last modified (default: false)
 * }
 *
 * GET /api/asana/sync-tasks
 * Returns sync status for all projects
 */

interface SyncResult {
  projectGid: string;
  projectName: string;
  tasksProcessed: number;
  tasksInserted: number;
  tasksUpdated: number;
  error?: string;
}

// Transform Asana task to cache format
function transformTaskForCache(task: AsanaTask, projectGid: string, projectName: string) {
  return {
    asana_gid: task.gid,
    name: task.name,
    notes: task.notes || null,
    project_gid: projectGid,
    project_name: projectName,
    section_gid: task.memberships?.[0]?.section?.gid || null,
    section_name: task.memberships?.[0]?.section?.name || null,
    assignee_gid: task.assignee?.gid || null,
    assignee_name: task.assignee?.name || null,
    assignee_email: task.assignee?.email || null,
    due_on: task.due_on || null,
    start_on: task.start_on || null,
    completed_at: task.completed_at || null,
    created_at_asana: task.created_at || null,
    modified_at_asana: task.modified_at || null,
    completed: task.completed || false,
    custom_fields: task.custom_fields ? JSON.stringify(
      task.custom_fields.map(cf => ({
        gid: cf.gid,
        name: cf.name,
        type: cf.type,
        value: cf.display_value || cf.text_value || cf.number_value || cf.enum_value?.name || null,
      }))
    ) : null,
    tags: task.tags ? JSON.stringify(
      task.tags.map(t => ({ gid: t.gid, name: t.name, color: t.color }))
    ) : null,
    synced_at: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { projectIds, fullSync = false } = body;

    const admin = getSupabaseAdmin();
    const results: SyncResult[] = [];

    // Get projects to sync
    let projectsToSync: Array<{ gid: string; name: string }> = [];

    if (projectIds && projectIds.length > 0) {
      // Sync specific projects
      projectsToSync = projectIds.map((gid: string) => ({ gid, name: 'Unknown' }));
    } else {
      // Sync all projects from workspace
      try {
        const projects = await listProjects();
        projectsToSync = projects.map(p => ({ gid: p.gid, name: p.name }));
      } catch (error) {
        return NextResponse.json({
          error: 'Failed to fetch Asana projects',
          message: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Process each project
    for (const project of projectsToSync) {
      const result: SyncResult = {
        projectGid: project.gid,
        projectName: project.name,
        tasksProcessed: 0,
        tasksInserted: 0,
        tasksUpdated: 0,
      };

      try {
        // Update sync status to 'syncing'
        await admin
          .from('asana_sync_status')
          .upsert({
            project_gid: project.gid,
            project_name: project.name,
            sync_status: 'syncing',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'project_gid' });

        // Get last sync time for incremental sync
        let modifiedSince: string | undefined;
        if (!fullSync) {
          const { data: syncStatus } = await admin
            .from('asana_sync_status')
            .select('last_modified_at')
            .eq('project_gid', project.gid)
            .single();

          if (syncStatus?.last_modified_at) {
            modifiedSince = syncStatus.last_modified_at;
          }
        }

        // Fetch tasks from Asana (include completed for full data)
        const tasks = await listTasks(project.gid, {
          modifiedSince,
          completedSince: fullSync ? undefined : modifiedSince,
        });

        result.tasksProcessed = tasks.length;

        // Track latest modification time
        let latestModified: string | null = null;

        // Upsert tasks in batches
        const batchSize = 50;
        for (let i = 0; i < tasks.length; i += batchSize) {
          const batch = tasks.slice(i, i + batchSize);
          const cacheRecords = batch.map(task => {
            // Track latest modification
            if (task.modified_at) {
              if (!latestModified || task.modified_at > latestModified) {
                latestModified = task.modified_at;
              }
            }
            return transformTaskForCache(task, project.gid, project.name);
          });

          const { error: upsertError, data } = await admin
            .from('asana_tasks_cache')
            .upsert(cacheRecords, {
              onConflict: 'asana_gid',
              ignoreDuplicates: false,
            })
            .select();

          if (upsertError) {
            console.error(`Error upserting tasks for project ${project.gid}:`, upsertError);
            throw upsertError;
          }

          result.tasksInserted += data?.length || 0;
        }

        // Update sync status to 'completed'
        await admin
          .from('asana_sync_status')
          .upsert({
            project_gid: project.gid,
            project_name: project.name,
            last_sync_at: new Date().toISOString(),
            last_modified_at: latestModified,
            task_count: result.tasksProcessed,
            sync_status: 'completed',
            error_message: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'project_gid' });

      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';

        // Update sync status to 'failed'
        await admin
          .from('asana_sync_status')
          .upsert({
            project_gid: project.gid,
            project_name: project.name,
            sync_status: 'failed',
            error_message: result.error,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'project_gid' });
      }

      results.push(result);
    }

    // Calculate totals
    const totals = {
      projectsSynced: results.filter(r => !r.error).length,
      projectsFailed: results.filter(r => r.error).length,
      totalTasks: results.reduce((sum, r) => sum + r.tasksProcessed, 0),
    };

    return NextResponse.json({
      success: true,
      message: `Synced ${totals.projectsSynced} projects with ${totals.totalTasks} tasks`,
      totals,
      results,
    });

  } catch (error) {
    console.error('Error syncing Asana tasks:', error);
    return NextResponse.json({
      error: 'Failed to sync Asana tasks',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    // Get sync status for all projects
    const { data: syncStatus, error } = await admin
      .from('asana_sync_status')
      .select('*')
      .order('last_sync_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get total cached tasks count
    const { count: totalTasks } = await admin
      .from('asana_tasks_cache')
      .select('*', { count: 'exact', head: true });

    // Get task counts by project
    const { data: projectCounts } = await admin
      .from('asana_tasks_cache')
      .select('project_gid, project_name')
      .order('project_name');

    // Group counts
    const countsByProject: Record<string, { name: string; count: number }> = {};
    projectCounts?.forEach(row => {
      if (!countsByProject[row.project_gid]) {
        countsByProject[row.project_gid] = { name: row.project_name || 'Unknown', count: 0 };
      }
      countsByProject[row.project_gid].count++;
    });

    return NextResponse.json({
      totalCachedTasks: totalTasks || 0,
      projects: syncStatus?.map(s => ({
        projectGid: s.project_gid,
        projectName: s.project_name,
        lastSyncAt: s.last_sync_at,
        lastModifiedAt: s.last_modified_at,
        taskCount: s.task_count,
        syncStatus: s.sync_status,
        errorMessage: s.error_message,
        cachedTaskCount: countsByProject[s.project_gid]?.count || 0,
      })) || [],
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({
      error: 'Failed to get sync status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
