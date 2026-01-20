/**
 * API Route: /api/closeout/projects
 * Returns a list of distinct project names with financial summary and categorization
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ProjectData {
  project_name: string;
  project_year: number;
  project_type: string;
  actual_revenue: number;
  actual_gp_pct: number;
  variance: number;
}

interface ProjectSummary {
  name: string;
  years: number[];
  latestYear: number;
  projectType: string;
  recentRevenue: number;
  recentGPM: number;
  recentVariance: number;
  isAtRisk: boolean;
  isHighValue: boolean;
  isRecent: boolean;
  hasData: boolean;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minYear = searchParams.get('minYear');
    const category = searchParams.get('category');
    const legacy = searchParams.get('legacy') === 'true';

    const supabase = getSupabaseAdmin();

    // Get project data with financial information
    let query = supabase
      .from('closeout_projects')
      .select('project_name, project_year, project_type, actual_revenue, actual_gp_pct, variance')
      .gt('project_year', 0) // Include all valid years
      .order('project_name', { ascending: true })
      .order('project_year', { ascending: false });

    // Apply optional year filter
    if (minYear) {
      query = query.gte('project_year', parseInt(minYear));
    }

    const { data: projects, error } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({
        error: 'Database error',
        message: error.message,
      }, { status: 500 });
    }

    // Group by project name and calculate summary metrics
    const projectMap = new Map<string, ProjectData[]>();

    for (const row of projects || []) {
      if (!row.project_name) continue;

      if (!projectMap.has(row.project_name)) {
        projectMap.set(row.project_name, []);
      }
      projectMap.get(row.project_name)!.push(row as ProjectData);
    }

    // Convert to enhanced project summaries
    let projectList: ProjectSummary[] = Array.from(projectMap.entries()).map(([name, yearData]) => {
      // Sort by year descending to get most recent first
      const sortedData = yearData.sort((a, b) => b.project_year - a.project_year);
      const mostRecent = sortedData[0];
      const years = sortedData.map(d => d.project_year);

      const recentRevenue = mostRecent.actual_revenue || 0;
      const recentGPM = mostRecent.actual_gp_pct || 0;
      const recentVariance = mostRecent.variance || 0;

      return {
        name,
        years,
        latestYear: mostRecent.project_year,
        projectType: mostRecent.project_type || '',
        recentRevenue,
        recentGPM,
        recentVariance,
        isAtRisk: recentGPM < 50 || recentVariance < -10000,
        isHighValue: recentRevenue > 500000,
        isRecent: mostRecent.project_year >= 2024,
        hasData: recentRevenue > 0,
      };
    });

    // Apply category filter
    if (category) {
      switch (category) {
        case 'recent':
          projectList = projectList.filter(p => p.isRecent);
          break;
        case 'at-risk':
          projectList = projectList.filter(p => p.isAtRisk);
          break;
        case 'high-value':
          projectList = projectList.filter(p => p.isHighValue);
          break;
        case 'all':
          // No filtering needed
          break;
      }
    }

    // Calculate stats
    const stats = {
      totalProjects: projectMap.size,
      recentCount: projectList.filter(p => p.isRecent).length,
      atRiskCount: projectList.filter(p => p.isAtRisk).length,
      highValueCount: projectList.filter(p => p.isHighValue).length,
      yearRange: {
        min: Math.min(...projectList.map(p => Math.min(...p.years))),
        max: Math.max(...projectList.map(p => Math.max(...p.years))),
      },
    };

    // Legacy format support for backward compatibility
    if (legacy) {
      return NextResponse.json({
        projects: projectList.map(p => ({ name: p.name, years: p.years })),
        count: projectList.length,
      });
    }

    return NextResponse.json({
      projects: projectList,
      count: projectList.length,
      stats,
    });

  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
