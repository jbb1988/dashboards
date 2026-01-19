/**
 * API Route: /api/closeout/projects
 * Returns a list of distinct project names for the dropdown
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Get distinct project names with their years (2025 and later only)
    const { data: projects, error } = await supabase
      .from('closeout_projects')
      .select('project_name, project_year')
      .gte('project_year', 2025) // Only include 2025 and later
      .order('project_name', { ascending: true });

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({
        error: 'Database error',
        message: error.message,
      }, { status: 500 });
    }

    // Group by project name to get unique projects with all their years
    const projectMap = new Map<string, Set<number>>();

    for (const row of projects || []) {
      if (!row.project_name) continue;

      if (!projectMap.has(row.project_name)) {
        projectMap.set(row.project_name, new Set());
      }
      if (row.project_year) {
        projectMap.get(row.project_name)!.add(row.project_year);
      }
    }

    // Convert to array format
    const projectList = Array.from(projectMap.entries()).map(([name, years]) => ({
      name,
      years: Array.from(years).sort((a, b) => b - a), // Most recent first
    }));

    return NextResponse.json({
      projects: projectList,
      count: projectList.length,
    });

  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
