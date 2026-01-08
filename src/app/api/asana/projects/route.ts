import { NextResponse } from 'next/server';
import { listProjects, listWorkspaces } from '@/lib/asana';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check for token
    if (!process.env.ASANA_ACCESS_TOKEN) {
      return NextResponse.json({
        error: 'Asana not configured',
        message: 'ASANA_ACCESS_TOKEN is not set in environment variables',
      }, { status: 500 });
    }

    // Get workspace if not set
    let workspaceId = process.env.ASANA_WORKSPACE_ID;
    let workspaceName = 'Unknown';

    if (!workspaceId) {
      const workspaces = await listWorkspaces();
      if (workspaces.length === 0) {
        return NextResponse.json({
          error: 'No workspaces found',
          message: 'No Asana workspaces accessible with this token',
        }, { status: 404 });
      }
      workspaceId = workspaces[0].gid;
      workspaceName = workspaces[0].name;
    }

    // Fetch projects
    const projects = await listProjects(workspaceId);

    // Sort by name
    projects.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      workspace: {
        gid: workspaceId,
        name: workspaceName,
      },
      projects: projects.map(p => ({
        gid: p.gid,
        name: p.name,
        color: p.color,
        archived: p.archived,
        public: p.public,
        notes: p.notes?.substring(0, 200),
        team: p.team?.name,
        createdAt: p.created_at,
        modifiedAt: p.modified_at,
      })),
      count: projects.length,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching Asana projects:', error);
    return NextResponse.json({
      error: 'Failed to fetch projects',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
