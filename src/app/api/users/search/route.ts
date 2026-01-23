import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET /api/users/search?q=john
// Returns users from user_roles table for @mention autocomplete
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const admin = getSupabaseAdmin();

    const { data: users, error } = await admin
      .from('user_roles')
      .select('email, role')
      .ilike('email', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Failed to search users:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      users: users || [],
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
