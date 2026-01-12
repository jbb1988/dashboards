import { NextResponse } from 'next/server';

/**
 * GET /api/admin/check-migrations
 * Checks which tables exist in the database vs which migrations are defined
 */
export async function GET() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!accessToken || !projectRef) {
    return NextResponse.json(
      { error: 'Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF' },
      { status: 500 }
    );
  }

  // Expected tables from migrations
  const expectedTables = [
    { table: 'contracts', migration: '001_create_contracts_table.sql' },
    { table: 'documents', migration: '002_create_documents_table.sql' },
    { table: 'saved_views', migration: '002_create_documents_table.sql' },
    { table: 'tasks', migration: '003_create_tasks_table.sql' },
    { table: 'bundle_opportunities', migration: '004_create_bundles_table.sql' },
    { table: 'bundle_assignments', migration: '004_create_bundles_table.sql' },
    { table: 'diversified_sales', migration: '005_create_diversified_tables.sql' },
    { table: 'diversified_budgets', migration: '005_create_diversified_tables.sql' },
    { table: 'salesforce_sync_log', migration: '006_add_salesforce_sync_tracking.sql' },
    { table: 'project_profitability', migration: '007_create_project_profitability.sql' },
    { table: 'project_budgets', migration: '007_create_project_profitability.sql' },
    { table: 'project_profitability_sync_log', migration: '007_create_project_profitability.sql' },
    { table: 'user_profiles', migration: '010_user_management_v2.sql' },
    { table: 'contract_reviews', migration: '20260112_create_contract_reviews.sql' },
    { table: 'oauth_tokens', migration: 'core (oauth_tokens)' },
    { table: 'user_roles', migration: 'core (user_roles)' },
  ];

  try {
    // Query to get all tables in public schema
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: `Management API error: ${response.status}`,
        details: errorText
      }, { status: 500 });
    }

    const result = await response.json();
    const existingTables = new Set(result.map((r: { table_name: string }) => r.table_name));

    // Check each expected table
    const tableStatus = expectedTables.map(({ table, migration }) => ({
      table,
      migration,
      exists: existingTables.has(table),
      status: existingTables.has(table) ? '✅ EXISTS' : '❌ MISSING'
    }));

    const missing = tableStatus.filter(t => !t.exists);
    const existing = tableStatus.filter(t => t.exists);

    // Also check for any extra tables not in our expected list
    const expectedTableNames = new Set(expectedTables.map(t => t.table));
    const extraTables = Array.from(existingTables).filter(t => !expectedTableNames.has(t as string));

    return NextResponse.json({
      summary: {
        total: expectedTables.length,
        existing: existing.length,
        missing: missing.length,
      },
      missing: missing.map(t => ({ table: t.table, migration: t.migration })),
      existing: existing.map(t => t.table),
      extraTables: extraTables,
      allTables: tableStatus,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
