/**
 * Dashboards API - List available dashboards for permission management
 *
 * GET - List all dashboards grouped by category
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAllDashboards, getDashboardsByCategory, getUserRoleName } from '@/lib/permissions';

// Helper to check if user is admin
async function isAdmin(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const roleName = await getUserRoleName(user.id);
  return roleName === 'admin';
}

// GET - List all dashboards
export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const grouped = searchParams.get('grouped') === 'true';

    if (grouped) {
      const dashboardsByCategory = await getDashboardsByCategory();
      return NextResponse.json({ dashboards: dashboardsByCategory });
    }

    const dashboards = await getAllDashboards();
    return NextResponse.json({
      dashboards: dashboards.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        icon: d.icon,
        category: d.category,
        route: d.route,
        sort_order: d.sort_order,
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboards' },
      { status: 500 }
    );
  }
}
