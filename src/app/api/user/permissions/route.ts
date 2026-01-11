/**
 * User Permissions API
 * Returns the current user's accessible dashboards and routes
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getUserEffectiveDashboards, getUserRoleName } from '@/lib/permissions';

export async function GET() {
  try {
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

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's role name
    const roleName = await getUserRoleName(user.id);

    // Get effective dashboards with access info
    const effectiveDashboards = await getUserEffectiveDashboards(user.id);

    // Build accessible routes list
    const accessibleRoutes = effectiveDashboards
      .filter(d => d.has_access)
      .map(d => d.route);

    // Build dashboard info for sidebar
    const dashboards = effectiveDashboards.map(d => ({
      id: d.dashboard_id,
      name: d.dashboard_name,
      route: d.route,
      category: d.category,
      sortOrder: d.sort_order,
      hasAccess: d.has_access,
      accessSource: d.access_source,
    }));

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      role: roleName || 'viewer',
      accessibleRoutes,
      dashboards,
    });

  } catch (error) {
    console.error('Error in GET /api/user/permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
