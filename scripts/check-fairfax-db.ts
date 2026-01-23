/**
 * Diagnostic script to check Fairfax 2025 data in database
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

import { getSupabaseAdmin } from '../src/lib/supabase';

async function checkFairfax() {
  const supabase = getSupabaseAdmin();

  console.log('Checking Fairfax 2025 in database...\n');

  // Query closeout_projects for Fairfax 2025
  const { data: projects, error: projectError } = await supabase
    .from('closeout_projects')
    .select('*')
    .ilike('project_name', '%fairfax%')
    .eq('project_year', 2025)
    .order('actual_revenue', { ascending: false });

  if (projectError) {
    console.error('Error querying projects:', projectError);
    return;
  }

  console.log(`Found ${projects?.length || 0} Fairfax 2025 projects:\n`);

  if (projects && projects.length > 0) {
    for (const project of projects) {
      console.log(`Project: ${project.project_name}`);
      console.log(`  ID: ${project.id}`);
      console.log(`  Type: ${project.project_type}`);
      console.log(`  Year: ${project.project_year}`);
      console.log(`  Month: ${project.project_month}`);
      console.log(`  Actual Revenue: $${project.actual_revenue.toLocaleString()}`);
      console.log(`  Actual Cost: $${project.actual_cost.toLocaleString()}`);
      console.log(`  Actual GP: $${project.actual_gp.toLocaleString()}`);
      console.log(`  Actual GP%: ${project.actual_gp_pct}%`);
      console.log(`  NetSuite Enriched: ${project.netsuite_enriched}`);
      console.log(`  Last Synced: ${project.last_synced_at}`);
      console.log();
    }
  }

  // Also check all Fairfax projects (any year) for comparison
  const { data: allProjects, error: allError } = await supabase
    .from('closeout_projects')
    .select('project_name, project_year, project_type, actual_revenue')
    .ilike('project_name', '%fairfax%')
    .order('project_year', { ascending: false })
    .order('actual_revenue', { ascending: false });

  if (!allError && allProjects) {
    console.log(`\nAll Fairfax projects in database (${allProjects.length} total):`);
    for (const p of allProjects) {
      console.log(`  ${p.project_name} ${p.project_year} (${p.project_type}): $${p.actual_revenue.toLocaleString()}`);
    }
  }
}

checkFairfax().catch(console.error);
