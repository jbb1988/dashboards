/**
 * User Sidebar Preferences API
 * GET: Returns user's pinned dashboards (or defaults if none set)
 * PUT: Updates user's pinned dashboards
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { DEFAULT_PINNED_ROUTES } from '@/lib/navigation';

// Default pinned dashboards (excluding Home which is always first)
const DEFAULT_PINNED_DASHBOARDS = DEFAULT_PINNED_ROUTES;

// Maximum number of custom pinned dashboards (excluding Home)
const MAX_PINNED_DASHBOARDS = 4;

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function GET() {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch user's sidebar preferences
    const { data: preferences, error } = await supabase
      .from('user_sidebar_preferences')
      .select('pinned_dashboards, updated_at')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (user has no preferences yet)
      console.error('Error fetching sidebar preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Return preferences or defaults
    return NextResponse.json({
      pinnedDashboards: preferences?.pinned_dashboards || DEFAULT_PINNED_DASHBOARDS,
      isCustomized: !!preferences,
      updatedAt: preferences?.updated_at || null,
    });

  } catch (error) {
    console.error('Error in GET /api/user/sidebar-preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { pinnedDashboards } = body;

    // Validate input
    if (!Array.isArray(pinnedDashboards)) {
      return NextResponse.json({ error: 'pinnedDashboards must be an array' }, { status: 400 });
    }

    if (pinnedDashboards.length > MAX_PINNED_DASHBOARDS) {
      return NextResponse.json({
        error: `Maximum ${MAX_PINNED_DASHBOARDS} pinned dashboards allowed (excluding Home)`
      }, { status: 400 });
    }

    // Validate all items are strings (routes)
    if (!pinnedDashboards.every(item => typeof item === 'string')) {
      return NextResponse.json({ error: 'All pinned dashboards must be route strings' }, { status: 400 });
    }

    // Upsert preferences
    const { data, error } = await supabase
      .from('user_sidebar_preferences')
      .upsert({
        user_id: user.id,
        pinned_dashboards: pinnedDashboards,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select('pinned_dashboards, updated_at')
      .single();

    if (error) {
      console.error('Error saving sidebar preferences:', error);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({
      pinnedDashboards: data.pinned_dashboards,
      isCustomized: true,
      updatedAt: data.updated_at,
    });

  } catch (error) {
    console.error('Error in PUT /api/user/sidebar-preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
