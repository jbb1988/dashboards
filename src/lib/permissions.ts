/**
 * User Permissions Utility
 * Handles role-based dashboard access with per-user overrides
 */

import { getSupabaseAdmin } from './supabase';

// Types
export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  route: string;
  sort_order: number;
  is_active: boolean;
}

export interface RoleDashboardAccess {
  role_id: string;
  dashboard_id: string;
}

export interface UserDashboardOverride {
  user_id: string;
  dashboard_id: string;
  access_type: 'grant' | 'revoke';
}

export interface UserEffectiveDashboard {
  dashboard_id: string;
  dashboard_name: string;
  route: string;
  category: string | null;
  sort_order: number;
  has_access: boolean;
  access_source: 'role' | 'grant' | 'revoke' | 'none';
}

// ============================================
// ROLE FUNCTIONS
// ============================================

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<Role[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('roles')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching roles:', error);
    return [];
  }

  return data as Role[];
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<Role | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (error) {
    console.error('Error fetching role:', error);
    return null;
  }

  return data as Role;
}

/**
 * Get role by name
 */
export async function getRoleByName(roleName: string): Promise<Role | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('roles')
    .select('*')
    .eq('name', roleName)
    .single();

  if (error) {
    console.error('Error fetching role by name:', error);
    return null;
  }

  return data as Role;
}

/**
 * Create a new role
 */
export async function createRole(role: { name: string; description?: string }): Promise<Role | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('roles')
    .insert({
      name: role.name,
      description: role.description || null,
      is_system: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating role:', error);
    return null;
  }

  return data as Role;
}

/**
 * Update a role
 */
export async function updateRole(
  roleId: string,
  updates: { name?: string; description?: string }
): Promise<Role | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('roles')
    .update(updates)
    .eq('id', roleId)
    .select()
    .single();

  if (error) {
    console.error('Error updating role:', error);
    return null;
  }

  return data as Role;
}

/**
 * Delete a role (only non-system roles)
 */
export async function deleteRole(roleId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();

  // First check if it's a system role
  const role = await getRoleById(roleId);
  if (!role || role.is_system) {
    console.error('Cannot delete system role');
    return false;
  }

  // Check if any users have this role
  const { data: users } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleId)
    .limit(1);

  if (users && users.length > 0) {
    console.error('Cannot delete role with assigned users');
    return false;
  }

  const { error } = await admin
    .from('roles')
    .delete()
    .eq('id', roleId);

  if (error) {
    console.error('Error deleting role:', error);
    return false;
  }

  return true;
}

/**
 * Get user count per role
 */
export async function getRoleUserCounts(): Promise<Record<string, number>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_roles')
    .select('role_id');

  if (error || !data) {
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    if (row.role_id) {
      counts[row.role_id] = (counts[row.role_id] || 0) + 1;
    }
  }

  return counts;
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

/**
 * Get all dashboards
 */
export async function getAllDashboards(): Promise<Dashboard[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('dashboards')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching dashboards:', error);
    return [];
  }

  return data as Dashboard[];
}

/**
 * Get dashboards grouped by category
 */
export async function getDashboardsByCategory(): Promise<Record<string, Dashboard[]>> {
  const dashboards = await getAllDashboards();
  const grouped: Record<string, Dashboard[]> = {};

  for (const dashboard of dashboards) {
    const category = dashboard.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(dashboard);
  }

  return grouped;
}

// ============================================
// ROLE-DASHBOARD ACCESS FUNCTIONS
// ============================================

/**
 * Get dashboard access for a role
 */
export async function getRoleDashboardAccess(roleId: string): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('role_dashboard_access')
    .select('dashboard_id')
    .eq('role_id', roleId);

  if (error) {
    console.error('Error fetching role dashboard access:', error);
    return [];
  }

  return data.map(d => d.dashboard_id);
}

/**
 * Set dashboard access for a role (replaces all existing)
 */
export async function setRoleDashboardAccess(
  roleId: string,
  dashboardIds: string[]
): Promise<boolean> {
  const admin = getSupabaseAdmin();

  // Delete existing access
  await admin
    .from('role_dashboard_access')
    .delete()
    .eq('role_id', roleId);

  // Insert new access
  if (dashboardIds.length > 0) {
    const { error } = await admin
      .from('role_dashboard_access')
      .insert(dashboardIds.map(dashboardId => ({
        role_id: roleId,
        dashboard_id: dashboardId,
      })));

    if (error) {
      console.error('Error setting role dashboard access:', error);
      return false;
    }
  }

  return true;
}

// ============================================
// USER DASHBOARD OVERRIDE FUNCTIONS
// ============================================

/**
 * Get dashboard overrides for a user
 */
export async function getUserDashboardOverrides(userId: string): Promise<UserDashboardOverride[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_dashboard_overrides')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user dashboard overrides:', error);
    return [];
  }

  return data as UserDashboardOverride[];
}

/**
 * Set a dashboard override for a user
 */
export async function setUserDashboardOverride(
  userId: string,
  dashboardId: string,
  accessType: 'grant' | 'revoke'
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_dashboard_overrides')
    .upsert({
      user_id: userId,
      dashboard_id: dashboardId,
      access_type: accessType,
    });

  if (error) {
    console.error('Error setting user dashboard override:', error);
    return false;
  }

  return true;
}

/**
 * Remove a dashboard override for a user
 */
export async function removeUserDashboardOverride(
  userId: string,
  dashboardId: string
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_dashboard_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('dashboard_id', dashboardId);

  if (error) {
    console.error('Error removing user dashboard override:', error);
    return false;
  }

  return true;
}

/**
 * Set multiple dashboard overrides for a user (replaces all existing)
 */
export async function setUserDashboardOverrides(
  userId: string,
  overrides: Array<{ dashboardId: string; accessType: 'grant' | 'revoke' }>
): Promise<boolean> {
  const admin = getSupabaseAdmin();

  // Delete existing overrides
  await admin
    .from('user_dashboard_overrides')
    .delete()
    .eq('user_id', userId);

  // Insert new overrides
  if (overrides.length > 0) {
    const { error } = await admin
      .from('user_dashboard_overrides')
      .insert(overrides.map(o => ({
        user_id: userId,
        dashboard_id: o.dashboardId,
        access_type: o.accessType,
      })));

    if (error) {
      console.error('Error setting user dashboard overrides:', error);
      return false;
    }
  }

  return true;
}

// ============================================
// EFFECTIVE PERMISSIONS FUNCTIONS
// ============================================

/**
 * Get user's role ID from user_roles table
 */
export async function getUserRoleId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_roles')
    .select('role_id, role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  // If role_id is set, use it; otherwise look up by role name
  if (data.role_id) {
    return data.role_id;
  }

  // Fallback: look up role by name
  if (data.role) {
    const role = await getRoleByName(data.role);
    return role?.id || null;
  }

  return null;
}

/**
 * Get effective dashboard access for a user
 * Combines role-based access with per-user overrides
 */
export async function getUserEffectiveDashboards(userId: string): Promise<UserEffectiveDashboard[]> {
  const admin = getSupabaseAdmin();

  // Get all dashboards
  const dashboards = await getAllDashboards();

  // Get user's role
  const roleId = await getUserRoleId(userId);
  let roleDashboardIds: string[] = [];

  if (roleId) {
    roleDashboardIds = await getRoleDashboardAccess(roleId);
  }

  // Get user's overrides
  const overrides = await getUserDashboardOverrides(userId);
  const overrideMap = new Map(overrides.map(o => [o.dashboard_id, o.access_type]));

  // Calculate effective access
  return dashboards.map(dashboard => {
    const override = overrideMap.get(dashboard.id);
    const hasRoleAccess = roleDashboardIds.includes(dashboard.id);

    let hasAccess: boolean;
    let accessSource: 'role' | 'grant' | 'revoke' | 'none';

    if (override === 'revoke') {
      hasAccess = false;
      accessSource = 'revoke';
    } else if (override === 'grant') {
      hasAccess = true;
      accessSource = 'grant';
    } else if (hasRoleAccess) {
      hasAccess = true;
      accessSource = 'role';
    } else {
      hasAccess = false;
      accessSource = 'none';
    }

    return {
      dashboard_id: dashboard.id,
      dashboard_name: dashboard.name,
      route: dashboard.route,
      category: dashboard.category,
      sort_order: dashboard.sort_order,
      has_access: hasAccess,
      access_source: accessSource,
    };
  });
}

/**
 * Get accessible dashboard routes for a user (for middleware/sidebar)
 */
export async function getUserAccessibleRoutes(userId: string): Promise<string[]> {
  const effectiveDashboards = await getUserEffectiveDashboards(userId);
  return effectiveDashboards
    .filter(d => d.has_access)
    .map(d => d.route);
}

/**
 * Check if user can access a specific route
 */
export async function canUserAccessRoute(userId: string, route: string): Promise<boolean> {
  const accessibleRoutes = await getUserAccessibleRoutes(userId);

  // Normalize route (remove trailing slash, etc.)
  const normalizedRoute = route.replace(/\/$/, '');

  // Check if any accessible route matches
  return accessibleRoutes.some(accessibleRoute => {
    const normalizedAccessible = accessibleRoute.replace(/\/$/, '');
    return normalizedRoute.startsWith(normalizedAccessible);
  });
}

/**
 * Get roles with their dashboard access (for admin UI)
 */
export async function getRolesWithDashboardAccess(): Promise<Array<Role & { dashboards: string[]; userCount: number }>> {
  const roles = await getAllRoles();
  const userCounts = await getRoleUserCounts();

  const rolesWithAccess = await Promise.all(
    roles.map(async (role) => {
      const dashboards = await getRoleDashboardAccess(role.id);
      return {
        ...role,
        dashboards,
        userCount: userCounts[role.id] || 0,
      };
    })
  );

  return rolesWithAccess;
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

/**
 * Get user role name (legacy compatibility)
 * Prefers role_id lookup, falls back to role string
 */
export async function getUserRoleName(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_roles')
    .select('role_id, role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  // If role_id is set, look up the role name
  if (data.role_id) {
    const role = await getRoleById(data.role_id);
    return role?.name || null;
  }

  // Fallback to role string
  return data.role || null;
}

/**
 * Assign a role to a user (by role ID)
 */
export async function assignUserRole(userId: string, roleId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();

  // Get the role to also store the name for backwards compatibility
  const role = await getRoleById(roleId);
  if (!role) {
    console.error('Role not found:', roleId);
    return false;
  }

  const { error } = await admin
    .from('user_roles')
    .upsert({
      user_id: userId,
      role_id: roleId,
      role: role.name, // Keep for backwards compatibility
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Error assigning user role:', error);
    return false;
  }

  return true;
}
