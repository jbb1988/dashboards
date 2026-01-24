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
  project_month: number | null;
  project_type: string;
  actual_revenue: number;
  actual_gp_pct: number;
  variance: number;
}

interface ProjectSummary {
  name: string;
  years: number[];
  latestYear: number;
  latestMonth: number | null;
  projectType: string;
  recentRevenue: number;
  recentGPM: number;
  recentVariance: number;
  isAtRisk: boolean;
  isHighValue: boolean;
  isRecent: boolean;
  hasData: boolean;
  multipleEngagements: boolean;  // True if project has multiple month/type entries
  engagementCount: number;  // Count of distinct engagements
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minYear = searchParams.get('minYear');
    const category = searchParams.get('category');
    const legacy = searchParams.get('legacy') === 'true';

    const supabase = getSupabaseAdmin();

    // Get project data with financial information (2025 and later only)
    let query = supabase
      .from('closeout_projects')
      .select('project_name, project_year, project_month, project_type, actual_revenue, actual_gp_pct, variance')
      .gte('project_year', 2025) // Only include 2025 and later
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

    // Get current year for recent projects filter
    const currentYear = new Date().getFullYear();

    // Treat each engagement as a separate project - DO NOT AGGREGATE
    // Each row in closeout_projects represents a distinct project/engagement
    let projectList: ProjectSummary[] = (projects || [])
      .filter(row => row.project_name) // Filter out null names
      .map((row) => {
        const revenue = row.actual_revenue || 0;
        const gpm = row.actual_gp_pct || 0;
        const variance = row.variance || 0;

        return {
          name: row.project_name,
          years: [row.project_year], // Single year since this is one engagement
          latestYear: row.project_year,
          latestMonth: row.project_month || null,
          projectType: row.project_type || '',
          recentRevenue: revenue,
          recentGPM: gpm,
          recentVariance: variance,
          isAtRisk: gpm < 50 || variance < -10000,
          isHighValue: revenue > 500000,
          isRecent: row.project_year >= 2024 && row.project_year <= currentYear,
          hasData: revenue > 0,
          multipleEngagements: false, // No longer applicable - each is separate
          engagementCount: 1, // Each entry is exactly one engagement
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
        case 'mcc':
          projectList = projectList.filter(p => p.projectType === 'MCC');
          break;
        case 'all':
          // No filtering needed
          break;
      }
    }

    // Calculate stats from all projects (before category filtering)
    // Note: Each entry in projectList is a separate engagement/project
    const allProjects = (projects || [])
      .filter(row => row.project_name)
      .map((row) => {
        const revenue = row.actual_revenue || 0;
        const gpm = row.actual_gp_pct || 0;
        const variance = row.variance || 0;

        return {
          name: row.project_name,
          years: [row.project_year],
          latestYear: row.project_year,
          latestMonth: row.project_month || null,
          projectType: row.project_type || '',
          recentRevenue: revenue,
          recentGPM: gpm,
          recentVariance: variance,
          isAtRisk: gpm < 50 || variance < -10000,
          isHighValue: revenue > 500000,
          isRecent: row.project_year >= 2024 && row.project_year <= currentYear,
          hasData: revenue > 0,
          multipleEngagements: false,
          engagementCount: 1,
        };
      });

    const stats = {
      totalProjects: allProjects.length,
      recentCount: allProjects.filter(p => p.isRecent).length,
      atRiskCount: allProjects.filter(p => p.isAtRisk).length,
      highValueCount: allProjects.filter(p => p.isHighValue).length,
      mccCount: allProjects.filter(p => p.projectType === 'MCC').length,
      yearRange: allProjects.length > 0 ? {
        min: Math.min(...allProjects.map(p => p.latestYear)),
        max: Math.max(...allProjects.map(p => p.latestYear)),
      } : { min: 0, max: 0 },
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
