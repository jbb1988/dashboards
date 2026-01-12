/**
 * Users API - Manage users, roles, and dashboard overrides
 *
 * GET    - List all users with roles and overrides
 * POST   - Create a new user (password or magic link)
 * PATCH  - Update user role or dashboard overrides
 * DELETE - Remove a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getAllRoles,
  getRoleByName,
  getUserDashboardOverrides,
  setUserDashboardOverrides,
  assignUserRole,
  getUserEffectiveDashboards,
} from '@/lib/permissions';

/**
 * GET - List all users with their roles and dashboard overrides
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Get all users from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching users:', authError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get all user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, role_id');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
    }

    // Get all roles for reference
    const roles = await getAllRoles();
    const roleMap = new Map(roles.map(r => [r.id, r]));

    // Create lookup for user roles
    const userRoleMap = new Map(userRoles?.map(r => [r.user_id, r]) || []);

    // Build users list with role info and overrides
    const usersWithDetails = await Promise.all(
      authUsers.users.map(async (user) => {
        const userRole = userRoleMap.get(user.id);
        let roleName = 'viewer';
        let roleId = null;

        if (userRole) {
          if (userRole.role_id) {
            const role = roleMap.get(userRole.role_id);
            if (role) {
              roleName = role.name;
              roleId = role.id;
            }
          } else if (userRole.role) {
            roleName = userRole.role;
            // Find role ID by name
            const role = roles.find(r => r.name === userRole.role);
            if (role) {
              roleId = role.id;
            }
          }
        }

        // Get dashboard overrides for this user
        const overrides = await getUserDashboardOverrides(user.id);

        return {
          id: user.id,
          email: user.email,
          role: roleName,
          roleId,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          overrides: overrides.map(o => ({
            dashboardId: o.dashboard_id,
            accessType: o.access_type,
          })),
          overrideCount: overrides.length,
        };
      })
    );

    return NextResponse.json({
      users: usersWithDetails,
      roles: roles.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
      })),
    });

  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create a new user
 * Supports both password-based and magic link (invite) creation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, roleId, role, inviteMethod = 'password' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Determine the role to assign
    let targetRoleId = roleId;
    let targetRoleName = role;

    if (!targetRoleId && role) {
      // Look up role by name
      const roleObj = await getRoleByName(role);
      if (roleObj) {
        targetRoleId = roleObj.id;
        targetRoleName = roleObj.name;
      }
    } else if (targetRoleId) {
      // Get role name from ID
      const roles = await getAllRoles();
      const roleObj = roles.find(r => r.id === targetRoleId);
      if (roleObj) {
        targetRoleName = roleObj.name;
      }
    }

    // Default to viewer if no role specified
    if (!targetRoleId) {
      const viewerRole = await getRoleByName('viewer');
      if (viewerRole) {
        targetRoleId = viewerRole.id;
        targetRoleName = 'viewer';
      }
    }

    let userId: string;

    if (inviteMethod === 'magic_link') {
      // Send magic link invitation
      const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/login?invited=true`,
      });

      if (inviteError) {
        console.error('Error sending invite:', inviteError);
        return NextResponse.json({ error: inviteError.message }, { status: 400 });
      }

      userId = inviteData.user.id;
    } else {
      // Create user with password
      if (!password) {
        return NextResponse.json({ error: 'Password is required for password-based creation' }, { status: 400 });
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
      });

      if (authError) {
        console.error('Error creating user:', authError);
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      userId = authData.user.id;
    }

    // Assign role
    if (targetRoleId) {
      const success = await assignUserRole(userId, targetRoleId);
      if (!success) {
        // User was created but role assignment failed - clean up
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: 'Failed to assign role' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        role: targetRoleName,
        roleId: targetRoleId,
        inviteMethod,
      },
    });

  } catch (error) {
    console.error('Error in POST /api/admin/users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update user role or dashboard overrides
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, roleId, role, overrides } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let updatedRoleId = roleId;
    let updatedRoleName = role;

    // Update role if provided
    if (roleId || role) {
      if (!roleId && role) {
        // Look up role by name
        const roleObj = await getRoleByName(role);
        if (roleObj) {
          updatedRoleId = roleObj.id;
          updatedRoleName = roleObj.name;
        } else {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
      } else if (roleId) {
        // Get role name from ID
        const roles = await getAllRoles();
        const roleObj = roles.find(r => r.id === roleId);
        if (roleObj) {
          updatedRoleName = roleObj.name;
        } else {
          return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
        }
      }

      if (updatedRoleId) {
        const success = await assignUserRole(userId, updatedRoleId);
        if (!success) {
          return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
        }
      }
    }

    // Update dashboard overrides if provided
    if (overrides && Array.isArray(overrides)) {
      const validOverrides = overrides
        .filter(o => o.dashboardId && (o.accessType === 'grant' || o.accessType === 'revoke'))
        .map(o => ({
          dashboardId: o.dashboardId,
          accessType: o.accessType as 'grant' | 'revoke',
        }));

      const success = await setUserDashboardOverrides(userId, validOverrides);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update dashboard overrides' }, { status: 500 });
      }
    }

    // Get updated user info
    const updatedOverrides = await getUserDashboardOverrides(userId);
    const effectiveDashboards = await getUserEffectiveDashboards(userId);

    return NextResponse.json({
      success: true,
      userId,
      role: updatedRoleName,
      roleId: updatedRoleId,
      overrides: updatedOverrides.map(o => ({
        dashboardId: o.dashboard_id,
        accessType: o.access_type,
      })),
      effectiveDashboards: effectiveDashboards.filter(d => d.has_access).map(d => d.dashboard_id),
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Send magic link to an existing user
 * Uses generateLink to create a magic link and returns it
 * Supabase will send the email automatically when using inviteUserByEmail for unconfirmed users
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // If we have userId but not email, look up the email
    let targetEmail = email;
    let targetUserId = userId;

    if (!targetEmail && userId) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError || !userData?.user?.email) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      targetEmail = userData.user.email;
    }

    if (!targetUserId && email) {
      // Look up userId by email
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (!listError && users) {
        const foundUser = users.find(u => u.email === email);
        if (foundUser) {
          targetUserId = foundUser.id;
        }
      }
    }

    // Generate a magic link using admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: {
        redirectTo: `${origin}/login?invited=true`,
      },
    });

    if (linkError) {
      console.error('Error generating magic link:', linkError);
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    // generateLink creates the link but doesn't send email
    // The link is in linkData.properties.action_link
    // We'll return success - the admin can share the link directly or
    // we can integrate with an email service later

    // For now, try inviteUserByEmail which sends the email automatically
    // This works for users who haven't confirmed their email yet
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(targetEmail, {
      redirectTo: `${origin}/login?invited=true`,
    });

    if (inviteError) {
      // If invite fails (user already confirmed), return the generated link
      console.log('inviteUserByEmail failed (user may already be confirmed):', inviteError.message);

      // Return the magic link URL for manual sharing
      if (linkData?.properties?.action_link) {
        return NextResponse.json({
          success: true,
          message: `User already confirmed. Magic link generated - check Supabase logs or use password reset.`,
          email: targetEmail,
          note: 'For confirmed users, they can use "Forgot Password" or you can reset their password.',
        });
      }

      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Magic link sent to ${targetEmail}`,
      email: targetEmail,
    });

  } catch (error) {
    console.error('Error in PUT /api/admin/users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Remove a user
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Delete role
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Delete dashboard overrides
    await supabase
      .from('user_dashboard_overrides')
      .delete()
      .eq('user_id', userId);

    // Delete user from auth
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId,
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
