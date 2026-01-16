/**
 * Closeout Data Access Layer
 * Handles database operations for closeout profitability tracking
 */

import { getSupabaseAdmin } from './supabase';
import * as XLSX from 'xlsx';

// Type definitions
export interface CloseoutProject {
  id: string;
  project_name: string;
  opportunity_id: string | null;
  project_type: string;
  project_year: number;
  project_month: number | null;

  budget_revenue: number;
  budget_cost: number;
  budget_gp: number;
  budget_gp_pct: number | null;

  actual_revenue: number;
  actual_cost: number;
  actual_gp: number;
  actual_gp_pct: number | null;

  variance: number;
  variance_pct: number | null;

  excel_source: string;
  excel_sheet: string;
  last_synced_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface CloseoutWorkOrder {
  id: string;
  closeout_project_id: string;

  wo_number: string;
  invoice_number: string | null;
  item_description: string | null;

  budget_revenue: number;
  budget_cost: number;
  budget_gp: number;

  actual_revenue: number;
  actual_cost: number;
  actual_gp: number;

  variance: number;
  comments: string | null;

  netsuite_enriched: boolean;
  netsuite_wo_id: string | null;
  netsuite_so_id: string | null;
  netsuite_so_number: string | null;
  netsuite_enriched_at: string | null;

  excel_row_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface NetSuiteWorkOrderDetail {
  id: string;
  closeout_wo_id: string | null;

  wo_id: string;
  wo_number: string;
  wo_status: string | null;
  wo_date: string | null;

  so_id: string | null;
  so_number: string | null;
  so_status: string | null;
  so_date: string | null;

  customer_id: string | null;
  customer_name: string | null;

  line_id: string | null;
  item_id: string | null;
  item_name: string | null;
  item_description: string | null;
  item_type: string | null;

  quantity: number | null;
  unit_price: number | null;
  line_amount: number | null;
  cost_estimate: number | null;

  source_type: string | null;
  fetched_at: string;
  created_at: string;
}

/**
 * Get closeout projects with optional filters
 */
export async function getCloseoutProjects(filters?: {
  year?: number;
  type?: string;
  customerName?: string;
}): Promise<CloseoutProject[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('closeout_projects')
    .select('*')
    .order('project_year', { ascending: false })
    .order('actual_revenue', { ascending: false });

  if (filters?.year) {
    query = query.eq('project_year', filters.year);
  }

  if (filters?.type) {
    query = query.eq('project_type', filters.type);
  }

  if (filters?.customerName) {
    query = query.ilike('project_name', `%${filters.customerName}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching closeout projects:', error);
    throw new Error(`Failed to fetch closeout projects: ${error.message}`);
  }

  return data || [];
}

/**
 * Get work orders for a project with optional NetSuite details
 */
export async function getWorkOrdersForProject(
  projectId: string,
  includeNetSuiteDetails = true
): Promise<(CloseoutWorkOrder & { lineItems?: NetSuiteWorkOrderDetail[] })[]> {
  const supabase = getSupabaseAdmin();

  // Fetch work orders
  const { data: workOrders, error: woError } = await supabase
    .from('closeout_work_orders')
    .select('*')
    .eq('closeout_project_id', projectId)
    .order('actual_revenue', { ascending: false });

  if (woError) {
    console.error('Error fetching work orders:', woError);
    throw new Error(`Failed to fetch work orders: ${woError.message}`);
  }

  if (!includeNetSuiteDetails || !workOrders || workOrders.length === 0) {
    return workOrders || [];
  }

  // Fetch NetSuite details for enriched work orders
  const enrichedWoIds = workOrders
    .filter(wo => wo.netsuite_enriched)
    .map(wo => wo.id);

  if (enrichedWoIds.length === 0) {
    return workOrders;
  }

  const { data: lineItems, error: lineError } = await supabase
    .from('netsuite_work_order_details')
    .select('*')
    .in('closeout_wo_id', enrichedWoIds);

  if (lineError) {
    console.error('Error fetching NetSuite line items:', lineError);
    // Don't fail the whole request, just return without line items
    return workOrders;
  }

  // Attach line items to work orders
  return workOrders.map(wo => ({
    ...wo,
    lineItems: wo.netsuite_enriched
      ? lineItems?.filter(li => li.closeout_wo_id === wo.id) || []
      : undefined,
  }));
}

/**
 * Import Excel data to database
 * Parses closeout worksheet and upserts to closeout_projects and closeout_work_orders tables
 */
export async function importCloseoutExcelToDatabase(
  fileBuffer: Buffer
): Promise<{
  projectsCreated: number;
  projectsUpdated: number;
  workOrdersCreated: number;
  workOrdersUpdated: number;
  errors: string[];
}> {
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  // Parse Excel workbook
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = 'TB & MCC Cost Audit 2020-Curren';
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }

  // Parse sheet to array
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Track statistics
  let projectsCreated = 0;
  let projectsUpdated = 0;
  let workOrdersCreated = 0;
  let workOrdersUpdated = 0;

  // Group rows by project (customer + year + type)
  const projectGroups: Record<string, {
    project: Partial<CloseoutProject>;
    workOrders: Partial<CloseoutWorkOrder>[];
  }> = {};

  // Parse rows (skip header rows, start from row 5 = index 4)
  for (let i = 4; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row[0] || row[0] === 'Open') continue;

    try {
      // Parse month value
      let monthVal = 0;
      const rawMonth = row[4];
      if (typeof rawMonth === 'number' && rawMonth > 1000) {
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + rawMonth * 24 * 60 * 60 * 1000);
        monthVal = jsDate.getMonth() + 1;
      } else if (typeof rawMonth === 'number' && rawMonth >= 1 && rawMonth <= 12) {
        monthVal = rawMonth;
      }

      const projectName = (row[0]?.toString() || '').trim();  // Trim whitespace
      const opportunityId = row[1]?.toString() || null;
      const projectType = (row[2]?.toString() || '').trim();  // Trim whitespace
      const projectYear = parseInt(row[3]) || 0;
      const projectMonth = monthVal;

      const invoiceNum = row[5]?.toString() || null;
      const woNumber = (row[16]?.toString() || '').trim();  // Column Q: WO#, trim whitespace
      const itemDescription = row[10]?.toString() || null;

      const budgetRevenue = parseFloat(row[11]) || 0;
      const budgetCost = parseFloat(row[12]) || 0;
      const budgetGP = parseFloat(row[13]) || 0;

      const actualRevenue = parseFloat(row[15]) || 0;
      const actualCost = parseFloat(row[22]) || 0;
      const actualGP = parseFloat(row[25]) || 0;

      const variance = parseFloat(row[28]) || 0;
      const comments = row[29]?.toString() || null;

      // Skip rows with missing critical data
      if (!projectName || projectYear === 0 || !projectType) {
        continue;  // Skip rows without complete project identification
      }

      // Create project key
      const projectKey = `${projectName}|${projectYear}|${projectType}`;

      // Initialize project group if doesn't exist
      if (!projectGroups[projectKey]) {
        projectGroups[projectKey] = {
          project: {
            project_name: projectName,
            opportunity_id: opportunityId,
            project_type: projectType,
            project_year: projectYear,
            project_month: projectMonth,
            budget_revenue: 0,
            budget_cost: 0,
            budget_gp: 0,
            actual_revenue: 0,
            actual_cost: 0,
            actual_gp: 0,
            variance: 0,
            excel_source: 'closeout-data.xlsx',
            excel_sheet: sheetName,
            last_synced_at: new Date().toISOString(),
          },
          workOrders: [],
        };
      }

      // Aggregate to project level
      const pg = projectGroups[projectKey];
      pg.project.budget_revenue = (pg.project.budget_revenue || 0) + budgetRevenue;
      pg.project.budget_cost = (pg.project.budget_cost || 0) + budgetCost;
      pg.project.budget_gp = (pg.project.budget_gp || 0) + budgetGP;
      pg.project.actual_revenue = (pg.project.actual_revenue || 0) + actualRevenue;
      pg.project.actual_cost = (pg.project.actual_cost || 0) + actualCost;
      pg.project.actual_gp = (pg.project.actual_gp || 0) + actualGP;
      pg.project.variance = (pg.project.variance || 0) + variance;

      // Add work order if has WO# or significant data
      if (woNumber || actualRevenue > 0 || budgetRevenue > 0) {
        pg.workOrders.push({
          wo_number: woNumber,
          invoice_number: invoiceNum,
          item_description: itemDescription,
          budget_revenue: budgetRevenue,
          budget_cost: budgetCost,
          budget_gp: budgetGP,
          actual_revenue: actualRevenue,
          actual_cost: actualCost,
          actual_gp: actualGP,
          variance: variance,
          comments: comments,
          excel_row_number: i + 1, // 1-indexed
          netsuite_enriched: false,
        });
      }
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
    }
  }

  // Calculate percentages for each project
  for (const pg of Object.values(projectGroups)) {
    const p = pg.project;
    if (p.budget_revenue && p.budget_revenue > 0) {
      p.budget_gp_pct = ((p.budget_gp || 0) / p.budget_revenue) * 100;
    }
    if (p.actual_revenue && p.actual_revenue > 0) {
      p.actual_gp_pct = ((p.actual_gp || 0) / p.actual_revenue) * 100;
    }
    if (p.budget_gp && p.budget_gp !== 0) {
      p.variance_pct = ((p.variance || 0) / Math.abs(p.budget_gp)) * 100;
    }
  }

  // DIAGNOSTIC: Show breakdown by year and sample projects
  const yearBreakdown: Record<number, number> = {};
  const typeBreakdown: Record<string, number> = {};
  Object.values(projectGroups).forEach(pg => {
    const year = pg.project.project_year;
    const type = pg.project.project_type || '(empty)';
    yearBreakdown[year] = (yearBreakdown[year] || 0) + 1;
    typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
  });
  console.log('Project breakdown by year:', yearBreakdown);
  console.log('Project breakdown by type:', typeBreakdown);
  console.log(`Total unique projects: ${Object.keys(projectGroups).length}`);
  console.log('Sample project keys (first 20):');
  Object.keys(projectGroups).slice(0, 20).forEach((key, idx) => {
    console.log(`  ${idx + 1}. "${key}"`);
  });

  // BATCH 1: Upsert all projects at once
  console.log(`Upserting ${Object.keys(projectGroups).length} projects...`);
  const allProjects = Object.values(projectGroups).map(pg => pg.project);

  const { data: projectsData, error: projectsError } = await supabase
    .from('closeout_projects')
    .upsert(allProjects, {
      onConflict: 'project_name,project_year,project_type',
      ignoreDuplicates: false,
    })
    .select('id, project_name, project_year, project_type');

  if (projectsError) {
    throw new Error(`Failed to upsert projects: ${projectsError.message}`);
  }

  projectsCreated = projectsData?.length || 0;
  console.log(`✓ Upserted ${projectsCreated} projects`);

  // Create a map of project key → project ID
  const projectIdMap: Record<string, string> = {};
  if (projectsData) {
    projectsData.forEach((p: any) => {
      const key = `${p.project_name}|${p.project_year}|${p.project_type}`;
      projectIdMap[key] = p.id;
    });
  }

  // BATCH 2: Delete all existing work orders for these projects (faster than per-project deletes)
  console.log('Clearing existing work orders...');
  const projectIds = Object.values(projectIdMap);
  if (projectIds.length > 0) {
    await supabase
      .from('closeout_work_orders')
      .delete()
      .in('closeout_project_id', projectIds);
  }

  // BATCH 3: Insert all work orders at once
  console.log('Inserting work orders...');
  const allWorkOrders: any[] = [];

  for (const [projectKey, projectGroup] of Object.entries(projectGroups)) {
    const projectId = projectIdMap[projectKey];
    if (!projectId) {
      errors.push(`Project ${projectGroup.project.project_name}: Could not find project ID`);
      continue;
    }

    projectGroup.workOrders.forEach(wo => {
      allWorkOrders.push({
        ...wo,
        closeout_project_id: projectId,
      });
    });
  }

  if (allWorkOrders.length > 0) {
    // Insert in batches of 1000 to avoid payload size limits
    const BATCH_SIZE = 1000;
    for (let i = 0; i < allWorkOrders.length; i += BATCH_SIZE) {
      const batch = allWorkOrders.slice(i, i + BATCH_SIZE);
      const { error: woError } = await supabase
        .from('closeout_work_orders')
        .insert(batch);

      if (woError) {
        errors.push(`Work orders batch ${i / BATCH_SIZE + 1}: ${woError.message}`);
      } else {
        workOrdersCreated += batch.length;
        console.log(`✓ Inserted work orders batch ${i / BATCH_SIZE + 1} (${batch.length} records)`);
      }
    }
  }

  console.log(`✓ Total: ${projectsCreated} projects, ${workOrdersCreated} work orders`)

  return {
    projectsCreated,
    projectsUpdated,
    workOrdersCreated,
    workOrdersUpdated,
    errors,
  };
}

/**
 * Enrich work order with NetSuite data
 * Fetches WO and linked SO details from NetSuite and caches in database
 */
export async function enrichWorkOrderFromNetSuite(
  woNumber: string
): Promise<{
  success: boolean;
  lineItemsAdded: number;
  error?: string;
}> {
  const { getWorkOrderByNumber, getSalesOrderWithLineItems } = await import('./netsuite');
  const supabase = getSupabaseAdmin();

  try {
    // Step 1: Get work order from closeout_work_orders table
    const { data: closeoutWO, error: woError } = await supabase
      .from('closeout_work_orders')
      .select('*')
      .eq('wo_number', woNumber)
      .single();

    if (woError || !closeoutWO) {
      return {
        success: false,
        lineItemsAdded: 0,
        error: `Work order ${woNumber} not found in closeout data`,
      };
    }

    // Step 2: Fetch work order from NetSuite
    const nsWorkOrder = await getWorkOrderByNumber(woNumber);
    if (!nsWorkOrder) {
      return {
        success: false,
        lineItemsAdded: 0,
        error: `Work order ${woNumber} not found in NetSuite`,
      };
    }

    // Step 3: Fetch linked Sales Order if exists
    let lineItems: any[] = [];
    if (nsWorkOrder.linkedSalesOrderId) {
      const nsSalesOrder = await getSalesOrderWithLineItems(nsWorkOrder.linkedSalesOrderId);
      if (nsSalesOrder) {
        lineItems = nsSalesOrder.lineItems;
      }
    }

    // Step 4: Cache line items in netsuite_work_order_details table
    if (lineItems.length > 0) {
      const detailRecords = lineItems.map(item => ({
        closeout_wo_id: closeoutWO.id,
        wo_id: nsWorkOrder.id,
        wo_number: nsWorkOrder.tranId,
        wo_status: nsWorkOrder.status,
        wo_date: nsWorkOrder.tranDate,
        so_id: nsWorkOrder.linkedSalesOrderId,
        so_number: nsWorkOrder.linkedSalesOrderNumber,
        customer_id: nsWorkOrder.customerId,
        customer_name: nsWorkOrder.customerName,
        line_id: item.lineId,
        item_id: item.itemId,
        item_name: item.itemName,
        item_description: item.itemDescription,
        item_type: item.itemType,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_amount: item.lineAmount,
        cost_estimate: item.costEstimate,
        source_type: 'sales_order',
      }));

      // Delete existing details for this WO
      await supabase
        .from('netsuite_work_order_details')
        .delete()
        .eq('closeout_wo_id', closeoutWO.id);

      // Insert new details
      const { error: insertError } = await supabase
        .from('netsuite_work_order_details')
        .insert(detailRecords);

      if (insertError) {
        console.error('Error inserting NetSuite details:', insertError);
        return {
          success: false,
          lineItemsAdded: 0,
          error: `Failed to cache line items: ${insertError.message}`,
        };
      }
    }

    // Step 5: Mark work order as enriched
    const { error: updateError } = await supabase
      .from('closeout_work_orders')
      .update({
        netsuite_enriched: true,
        netsuite_wo_id: nsWorkOrder.id,
        netsuite_so_id: nsWorkOrder.linkedSalesOrderId,
        netsuite_so_number: nsWorkOrder.linkedSalesOrderNumber,
        netsuite_enriched_at: new Date().toISOString(),
      })
      .eq('id', closeoutWO.id);

    if (updateError) {
      console.error('Error updating work order enrichment status:', updateError);
    }

    return {
      success: true,
      lineItemsAdded: lineItems.length,
    };
  } catch (error) {
    console.error(`Error enriching work order ${woNumber}:`, error);
    return {
      success: false,
      lineItemsAdded: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all work orders that need enrichment
 */
export async function getWorkOrdersNeedingEnrichment(filters?: {
  year?: number;
  projectId?: string;
}): Promise<CloseoutWorkOrder[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('closeout_work_orders')
    .select('*, closeout_projects!inner(*)')
    .eq('netsuite_enriched', false)
    .not('wo_number', 'is', null)
    .neq('wo_number', '');

  if (filters?.year) {
    query = query.eq('closeout_projects.project_year', filters.year);
  }

  if (filters?.projectId) {
    query = query.eq('closeout_project_id', filters.projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching work orders needing enrichment:', error);
    throw new Error(`Failed to fetch work orders: ${error.message}`);
  }

  return data || [];
}
