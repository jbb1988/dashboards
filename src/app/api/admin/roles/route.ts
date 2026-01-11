/**
 * Roles API - Manage custom roles and their dashboard access
 *
 * GET    - List all roles with dashboard access
 * POST   - Create a new role
 * PATCH  - Update a role (name, description, dashboard access)
 * DELETE - Delete a role (non-system only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getRoleDashboardAccess,
  setRoleDashboardAccess,
  getRoleUserCounts,
  getUserRoleName,
} from '@/lib/permissions';
import { getAllDashboards } from '@/lib/permissions';

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

// GET - List all roles with dashboard access
export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const roles = await getAllRoles();
    const userCounts = await getRoleUserCounts();
    const dashboards = await getAllDashboards();

    // Get dashboard access for each role
    const rolesWithAccess = await Promise.all(
      roles.map(async (role) => {
        const dashboardIds = await getRoleDashboardAccess(role.id);
        return {
          ...role,
          dashboards: dashboardIds,
          userCount: userCounts[role.id] || 0,
        };
      })
    );

    return NextResponse.json({
      roles: rolesWithAccess,
      dashboards: dashboards.map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        icon: d.icon,
      })),
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

// POST - Create a new role
export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, dashboards } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Role name is required' },
        { status: 400 }
      );
    }

    // Create the role
    const role = await createRole({ name, description });
    if (!role) {
      return NextResponse.json(
        { error: 'Failed to create role' },
        { status: 500 }
      );
    }

    // Set dashboard access if provided
    if (dashboards && Array.isArray(dashboards)) {
      await setRoleDashboardAccess(role.id, dashboards);
    }

    // Get the role with dashboard access
    const dashboardIds = await getRoleDashboardAccess(role.id);

    return NextResponse.json({
      role: {
        ...role,
        dashboards: dashboardIds,
        userCount: 0,
      },
    });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}

// PATCH - Update a role
export async function PATCH(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roleId, name, description, dashboards } = body;

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Get existing role
    const existingRole = await getRoleById(roleId);
    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Update role name/description if provided
    let updatedRole = existingRole;
    if (name || description !== undefined) {
      const updates: { name?: string; description?: string } = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;

      const result = await updateRole(roleId, updates);
      if (result) {
        updatedRole = result;
      }
    }

    // Update dashboard access if provided
    if (dashboards && Array.isArray(dashboards)) {
      await setRoleDashboardAccess(roleId, dashboards);
    }

    // Get updated dashboard access
    const dashboardIds = await getRoleDashboardAccess(roleId);
    const userCounts = await getRoleUserCounts();

    return NextResponse.json({
      role: {
        ...updatedRole,
        dashboards: dashboardIds,
        userCount: userCounts[roleId] || 0,
      },
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a role
export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Check if it's a system role
    const role = await getRoleById(roleId);
    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    if (role.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system role' },
        { status: 400 }
      );
    }

    // Check if any users have this role
    const userCounts = await getRoleUserCounts();
    if (userCounts[roleId] && userCounts[roleId] > 0) {
      return NextResponse.json(
        { error: `Cannot delete role with ${userCounts[roleId]} assigned user(s). Reassign users first.` },
        { status: 400 }
      );
    }

    const success = await deleteRole(roleId);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete role' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
