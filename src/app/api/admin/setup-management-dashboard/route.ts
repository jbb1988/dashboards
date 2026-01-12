/**
 * Setup Management Dashboard
 * Adds the management dashboard to the database and grants access to admin role
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    const admin = getSupabaseAdmin();

    // 1. Add the dashboard to the dashboards table
    const { data: dashboard, error: dashboardError } = await admin
      .from('dashboards')
      .upsert({
        name: 'Strategic Initiatives',
        description: '2026 company pillars & objectives tracking',
        icon: 'chart-bar',
        category: 'Management',
        route: '/management-dashboard',
        sort_order: 50,
        is_active: true,
      }, {
        onConflict: 'route',
      })
      .select()
      .single();

    if (dashboardError) {
      console.error('Error creating dashboard:', dashboardError);
      return NextResponse.json({ error: 'Failed to create dashboard', details: dashboardError }, { status: 500 });
    }

    // 2. Get admin role
    const { data: adminRole, error: roleError } = await admin
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .single();

    if (roleError || !adminRole) {
      console.error('Error finding admin role:', roleError);
      return NextResponse.json({
        success: true,
        dashboard,
        warning: 'Dashboard created but could not grant admin access - role not found'
      });
    }

    // 3. Grant access to admin role
    const { error: accessError } = await admin
      .from('role_dashboard_access')
      .upsert({
        role_id: adminRole.id,
        dashboard_id: dashboard.id,
      }, {
        onConflict: 'role_id,dashboard_id',
      });

    if (accessError) {
      console.error('Error granting access:', accessError);
      return NextResponse.json({
        success: true,
        dashboard,
        warning: 'Dashboard created but could not grant admin access'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Management Dashboard setup complete',
      dashboard,
      accessGranted: true,
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      error: 'Setup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support GET for easy browser testing
export async function GET() {
  return POST();
}
