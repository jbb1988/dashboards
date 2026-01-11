import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication (excluding public routes)
const protectedRoutes = [
  '/contracts-dashboard',
  '/mcc-dashboard',
  '/closeout-dashboard',
  '/pm-dashboard',
  '/contracts/review',
  '/diversified-dashboard',
  '/admin',
];

// Routes accessible to everyone (including unauthenticated)
const publicRoutes = [
  '/guides',
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Check if this is a public route (allow without auth)
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return supabaseResponse;
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect to login if not authenticated on protected routes
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // If authenticated and on a protected route, check database permissions
  if (isProtectedRoute && user) {
    // Get user's role and role_id
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role_id, role')
      .eq('user_id', user.id)
      .single();

    if (!userRole) {
      // No role assigned, redirect to home
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // Get role's dashboard access (routes from dashboards table)
    let roleDashboardRoutes: string[] = [];

    if (userRole.role_id) {
      // Use role_id for database-driven permissions
      const { data: roleAccess } = await supabase
        .from('role_dashboard_access')
        .select('dashboard_id, dashboards(route)')
        .eq('role_id', userRole.role_id);

      if (roleAccess) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const ra of roleAccess as any[]) {
          if (ra.dashboards?.route) {
            roleDashboardRoutes.push(ra.dashboards.route);
          }
        }
      }
    }

    // Get user's dashboard overrides
    const { data: overrides } = await supabase
      .from('user_dashboard_overrides')
      .select('dashboard_id, access_type, dashboards(route)')
      .eq('user_id', user.id);

    // Build final accessible routes
    const grantedRoutes = new Set(roleDashboardRoutes);

    if (overrides) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const override of overrides as any[]) {
        if (!override.dashboards?.route) continue;

        if (override.access_type === 'grant') {
          grantedRoutes.add(override.dashboards.route);
        } else if (override.access_type === 'revoke') {
          grantedRoutes.delete(override.dashboards.route);
        }
      }
    }

    // Check if user has access to the current path
    const hasAccess = Array.from(grantedRoutes).some((route) =>
      pathname.startsWith(route)
    );

    if (!hasAccess) {
      // Redirect to home if no access
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Redirect to first accessible dashboard if already logged in and trying to access login
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handle auth separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};
