/**
 * API Authentication Utilities
 * Provides user authentication for API routes
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Get authenticated user from request cookies
 * Returns user object if authenticated, null otherwise
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // We don't need to set cookies in API routes
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Get user's role from database
 */
export async function getUserRole(userId: string) {
  try {
    const { getSupabaseAdmin } = await import('./supabase');
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return 'viewer'; // Default role
    }

    return data.role as string;
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'viewer';
  }
}

/**
 * Require authentication for an API route
 * Returns user if authenticated, or sends 401 response
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;
  role: string;
} | NextResponse> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized - Please log in' },
      { status: 401 }
    );
  }

  const role = await getUserRole(user.id);

  return { user, role };
}

/**
 * Check if result is an error response
 */
export function isAuthError(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Role-based access check
 */
export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  // Admin has access to everything
  if (userRole === 'admin') return true;
  return allowedRoles.includes(userRole);
}

/**
 * Create unauthorized response with custom message
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create forbidden response (authenticated but not allowed)
 */
export function forbiddenResponse(message = 'Access denied'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
