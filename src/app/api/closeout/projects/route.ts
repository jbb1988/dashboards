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

    // GROUP BY (name, year, month) - each month is a separate engagement/project
    // Multiple project_types in the same month (TBEN, PM, TBIN, etc.) are line items in one SO
    const engagementMap = new Map<string, ProjectData[]>();

    for (const row of (projects || [])) {
      if (!row.project_name) continue;

      // Key by name + year + month (month is the engagement identifier)
      const key = `${row.project_name}|${row.project_year}|${row.project_month || 'null'}`;

      if (!engagementMap.has(key)) {
        engagementMap.set(key, []);
      }
      engagementMap.get(key)!.push(row as ProjectData);
    }

    // Convert grouped engagements to project summaries
    let projectList: ProjectSummary[] = Array.from(engagementMap.entries()).map(([key, rows]) => {
      // Sum revenue across all project_types in this engagement
      const totalRevenue = rows.reduce((sum, r) => sum + (r.actual_revenue || 0), 0);

      // Use weighted average for GPM based on revenue
      let weightedGPM = 0;
      if (totalRevenue > 0) {
        weightedGPM = rows.reduce((sum, r) => {
          const rev = r.actual_revenue || 0;
          const gpm = r.actual_gp_pct || 0;
          return sum + (gpm * rev);
        }, 0) / totalRevenue;
      }

      // Sum variance across all project types
      const totalVariance = rows.reduce((sum, r) => sum + (r.variance || 0), 0);

      // Determine primary project type (prefer TBEN, MCC, or first non-PM type)
      const primaryType = rows.find(r => ['TBEN', 'TBEU', 'MCC', 'M3NEW'].includes(r.project_type))?.project_type
        || rows.find(r => r.project_type !== 'PM')?.project_type
        || rows[0].project_type;

      return {
        name: rows[0].project_name,
        years: [rows[0].project_year],
        latestYear: rows[0].project_year,
        latestMonth: rows[0].project_month || null,
        projectType: primaryType || '',
        recentRevenue: totalRevenue,
        recentGPM: weightedGPM,
        recentVariance: totalVariance,
        isAtRisk: weightedGPM < 50 || totalVariance < -10000,
        isHighValue: totalRevenue > 500000,
        isRecent: rows[0].project_year >= 2024 && rows[0].project_year <= currentYear,
        hasData: totalRevenue > 0,
        multipleEngagements: false,
        engagementCount: 1,
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

    // Calculate stats from all engagements (grouped by name+year+month)
    const allProjects = Array.from(engagementMap.values()).map(rows => {
      const totalRevenue = rows.reduce((sum, r) => sum + (r.actual_revenue || 0), 0);

      let weightedGPM = 0;
      if (totalRevenue > 0) {
        weightedGPM = rows.reduce((sum, r) => {
          const rev = r.actual_revenue || 0;
          const gpm = r.actual_gp_pct || 0;
          return sum + (gpm * rev);
        }, 0) / totalRevenue;
      }

      const totalVariance = rows.reduce((sum, r) => sum + (r.variance || 0), 0);

      const primaryType = rows.find(r => ['TBEN', 'TBEU', 'MCC', 'M3NEW'].includes(r.project_type))?.project_type
        || rows.find(r => r.project_type !== 'PM')?.project_type
        || rows[0].project_type;

      return {
        name: rows[0].project_name,
        years: [rows[0].project_year],
        latestYear: rows[0].project_year,
        latestMonth: rows[0].project_month || null,
        projectType: primaryType || '',
        recentRevenue: totalRevenue,
        recentGPM: weightedGPM,
        recentVariance: totalVariance,
        isAtRisk: weightedGPM < 50 || totalVariance < -10000,
        isHighValue: totalRevenue > 500000,
        isRecent: rows[0].project_year >= 2024 && rows[0].project_year <= currentYear,
        hasData: totalRevenue > 0,
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
