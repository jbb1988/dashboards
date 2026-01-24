/**
 * API Route: /api/closeout/profitability
 * Project Profitability Dashboard API - REDESIGNED
 *
 * NEW STRUCTURE:
 * 1. High-level KPIs (Revenue, Cost, GP, GPM%, CPI)
 * 2. Sales Orders with line items grouped by PRODUCT TYPE (not item number)
 * 3. Work Orders with detailed cost breakdown
 * 4. Rollup validation (line items → product type → SO total → project total)
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseProjectType } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

// Product type full names
const PRODUCT_TYPE_NAMES: Record<string, string> = {
  'TBEN': 'Test Bench Equipment New',
  'TBEU': 'Test Bench Equipment Upgrade',
  'TBIN': 'Test Bench Install & Training New',
  'TBIU': 'Test Bench Install & Training Upgrade',
  'M3IN': 'M3 Install New',
  'M3IU': 'M3 Install Upgrade',
  'M3NEW': 'M3 Software New',
  'M3 Software': 'M3 Software',
  'DRM3': 'Deferred Revenue M3',
  'DRMCC': 'Deferred Revenue MCC',
  'TB Service': 'Test Bench Service/Maintenance',
  'MCC': 'Maintenance & Calibration Services',
  'TB Components': 'Test Bench Components',
  'PM': 'Project Management',
  'SCH': 'Shipping & Handling',
  'Other': 'Other',
  'Unknown': 'Unknown Product Type',
};

// Enhanced SO Line Item with account and product type info
interface EnhancedSOLineItem {
  lineNumber: number;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  rate: number;
  amount: number;
  costEstimate: number;
  grossProfit: number;
  grossMarginPct: number;
  isClosed: boolean;
  accountNumber: string | null;
  accountName: string | null;
  productType: string; // Derived from account_number
  revRecStartDate: string | null; // Revenue recognition start date
  revRecEndDate: string | null; // Revenue recognition end date
}

// Product type group (lines grouped by product type)
interface ProductTypeGroup {
  productType: string;
  productTypeName: string;
  lineItems: EnhancedSOLineItem[];
  totals: {
    lineItemCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

// Rollup validation structure
interface RollupValidation {
  productTypeBreakdown: Array<{ type: string; total: number }>;
  lineItemsTotal: number;
  expectedTotal: number;
  variance: number;
  variancePct: number;
  valid: boolean;
}

// Sales Order with product type grouping
interface LinkedSalesOrder {
  soNumber: string;
  netsuiteId: string;
  soDate: string | null;
  status: string | null;
  customerName: string | null;
  totalAmount: number;
  productTypeGroups: ProductTypeGroup[];
  rollupValidation: RollupValidation;
  totals: {
    lineItemCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

// Work Order Line Item
interface WOLineItem {
  lineNumber: number;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  quantityCompleted: number;
  unitCost: number;
  lineCost: number;
  costEstimate: number;
  actualCost: number | null;
  isClosed: boolean;
  completionPct: number;
}

// Work Order with cost breakdown
interface WorkOrderDetail {
  woNumber: string;
  netsuiteId: string;
  woDate: string | null;
  status: string | null;
  linkedSONumber: string | null;
  lineItems: WOLineItem[];
  totals: {
    lineItemCount: number;
    totalEstimatedCost: number;
    totalActualCost: number | null;
    totalCost: number;
  };
}

// Project-level totals and KPIs
interface ProjectKPIs {
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMarginPct: number;
  cpi: number; // Cost Performance Index (budget / actual)
  budgetRevenue: number;
  budgetCost: number;
  actualRevenue: number;
  actualCost: number;
}

// Main API response
interface ProjectProfitabilityResponse {
  project: {
    name: string;
    year: number | null;
    month: number | null;
    projectType: string | null;
    customerName: string | null;
  };
  kpis: ProjectKPIs;
  salesOrders: LinkedSalesOrder[];
  workOrders: WorkOrderDetail[];
  syncStatus: {
    lastSyncedAt: string | null;
    workOrderCount: number;
    salesOrderCount: number;
    dataSource?: 'database' | 'wip-report';
    budgetSource?: 'netsuite' | 'excel';
    note?: string;
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectName = url.searchParams.get('project');
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : null;
    const monthParam = url.searchParams.get('month');
    const month = monthParam ? parseInt(monthParam) : null;
    const projectType = url.searchParams.get('type');
    // Optional: Use WIP reports for real-time cost data (defaults to false)
    const useWipReport = url.searchParams.get('useWipReport') === 'true';

    if (!projectName) {
      return NextResponse.json({
        error: 'Missing required parameter',
        message: 'project parameter is required (e.g., ?project=Sarasota&year=2025&month=2&type=TBEN)',
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // STEP 1: Get Excel projects for KPI data
    let projectQuery = supabase
      .from('closeout_projects')
      .select('*')
      .ilike('project_name', `%${projectName}%`)
      .gt('project_year', 0);

    if (year) {
      projectQuery = projectQuery.eq('project_year', year);
    }

    if (month) {
      projectQuery = projectQuery.eq('project_month', month);
    }

    if (projectType) {
      projectQuery = projectQuery.eq('project_type', projectType);
    }

    const { data: excelProjects, error: projError } = await projectQuery;

    if (projError || !excelProjects || excelProjects.length === 0) {
      return NextResponse.json({
        error: 'No project found',
        message: `No project found for "${projectName}"${year ? ` in ${year}` : ''}`,
      }, { status: 404 });
    }

    // Try to get budget data from NetSuite budget table (if available)
    let budgetQuery = supabase
      .from('netsuite_project_budgets')
      .select('*')
      .ilike('project_name', `%${projectName}%`);

    if (year) {
      budgetQuery = budgetQuery.eq('project_year', year);
    }

    if (month) {
      budgetQuery = budgetQuery.eq('project_month', month);
    }

    if (projectType) {
      budgetQuery = budgetQuery.eq('project_type', projectType);
    }

    const { data: netSuiteBudgets } = await budgetQuery;

    // Calculate KPIs - prioritize NetSuite budget data over Excel
    let budgetRevenue = 0;
    let budgetCost = 0;
    let budgetSource: 'netsuite' | 'excel' = 'excel';

    if (netSuiteBudgets && netSuiteBudgets.length > 0) {
      // Use NetSuite budget data
      budgetRevenue = netSuiteBudgets.reduce((sum, p) => sum + (p.budget_revenue || 0), 0);
      budgetCost = netSuiteBudgets.reduce((sum, p) => sum + (p.budget_cost || 0), 0);
      budgetSource = 'netsuite';
    } else {
      // Fall back to Excel data
      budgetRevenue = excelProjects.reduce((sum, p) => sum + (p.budget_revenue || 0), 0);
      budgetCost = excelProjects.reduce((sum, p) => sum + (p.budget_cost || 0), 0);
    }

    const actualRevenue = excelProjects.reduce((sum, p) => sum + (p.actual_revenue || 0), 0);
    const actualCost = excelProjects.reduce((sum, p) => sum + (p.actual_cost || 0), 0);

    // STEP 2: Get all work orders for this project
    const { data: excelWOs } = await supabase
      .from('closeout_work_orders')
      .select('wo_number, closeout_project_id')
      .in('closeout_project_id', excelProjects.map(p => p.id))
      .not('wo_number', 'is', null)
      .neq('wo_number', '');

    const uniqueWONumbers = [...new Set((excelWOs || []).map(wo => `WO${wo.wo_number}`))];

    // STEP 3: Fetch Work Orders with line items from NetSuite
    const workOrders: WorkOrderDetail[] = [];
    const linkedSOIds: Set<string> = new Set();

    if (uniqueWONumbers.length > 0) {
      const { data: nsWOs } = await supabase
        .from('netsuite_work_orders')
        .select(`
          netsuite_id,
          wo_number,
          wo_date,
          status,
          created_from_so_id,
          created_from_so_number,
          total_actual_cost,
          netsuite_work_order_lines (
            line_number,
            item_id,
            item_name,
            item_description,
            item_type,
            quantity,
            quantity_completed,
            unit_cost,
            line_cost,
            cost_estimate,
            actual_cost,
            is_closed
          )
        `)
        .in('wo_number', uniqueWONumbers);

      if (nsWOs) {
        for (const wo of nsWOs) {
          if (wo.created_from_so_id) {
            linkedSOIds.add(wo.created_from_so_id);
          }

          const woLineItems: WOLineItem[] = (wo.netsuite_work_order_lines || []).map((line: any) => ({
            lineNumber: line.line_number || 0,
            itemId: line.item_id || '',
            itemName: line.item_name,
            itemDescription: line.item_description,
            itemType: line.item_type,
            quantity: line.quantity || 0,
            quantityCompleted: line.quantity_completed || 0,
            unitCost: line.unit_cost || 0,
            lineCost: line.line_cost || 0,
            costEstimate: line.cost_estimate || 0,
            actualCost: line.actual_cost,
            isClosed: line.is_closed || false,
            completionPct: line.quantity > 0 ? (line.quantity_completed / line.quantity) * 100 : 0,
          }));

          const totalEstimatedCost = woLineItems.reduce((sum, li) => sum + li.costEstimate, 0);

          // Calculate actual cost from both line_cost AND quantity fields
          // NetSuite stores costs differently based on item type:
          // - Material/Labor/Overhead: use line_cost
          // - Expense Reports/Shipping/Outside Services: use quantity (absolute value)
          const totalActualCost = woLineItems.reduce((sum, li) => {
            const itemName = (li.itemName || '').toLowerCase();
            const itemType = li.itemType || '';
            const quantity = li.quantity || 0;
            const lineCost = li.lineCost || 0;

            // For OthCharge items with zero line_cost but non-zero quantity,
            // check if it's an expense/shipping/service item that uses quantity field
            if (itemType === 'OthCharge' && Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01) {
              // Common patterns for items that store cost in quantity field:
              const usesQuantityField =
                itemName.includes('expense') ||
                itemName.includes('expense report') ||
                itemName.includes('exp rpt') ||
                itemName.includes('travel') ||
                itemName.includes('freight') ||
                itemName.includes('-freight') ||
                itemName.includes('shipping') ||
                itemName.includes('-material') ||
                itemName.includes('outside service') ||
                itemName.includes('misc material');

              if (usesQuantityField) {
                return sum + Math.abs(quantity);
              }
            }

            // For all other items, use line_cost
            return sum + Math.abs(lineCost);
          }, 0);

          const hasActualCost = totalActualCost > 0;

          workOrders.push({
            woNumber: wo.wo_number,
            netsuiteId: wo.netsuite_id,
            woDate: wo.wo_date,
            status: wo.status,
            linkedSONumber: wo.created_from_so_number,
            lineItems: woLineItems,
            totals: {
              lineItemCount: woLineItems.length,
              totalEstimatedCost,
              totalActualCost: hasActualCost ? totalActualCost : null,
              totalCost: hasActualCost ? totalActualCost : totalEstimatedCost,
            },
          });
        }
      }
    }

    // Collect item IDs from filtered work orders - these are the ONLY items we should count in SOs
    // This ensures we only sum SO revenue for items that are actually part of this engagement (month)
    const workOrderItemIds = new Set<string>();
    for (const wo of workOrders) {
      for (const line of wo.lineItems) {
        if (line.itemId) {
          workOrderItemIds.add(line.itemId);
        }
      }
    }

    // STEP 4: Fetch Sales Orders with enhanced line items (including account info)
    const salesOrders: LinkedSalesOrder[] = [];

    if (linkedSOIds.size > 0) {
      const { data: nsSOs } = await supabase
        .from('netsuite_sales_orders')
        .select(`
          netsuite_id,
          so_number,
          so_date,
          status,
          customer_name,
          total_amount,
          netsuite_sales_order_lines (
            line_number,
            item_id,
            item_name,
            item_description,
            item_type,
            item_class_id,
            item_class_name,
            quantity,
            rate,
            amount,
            cost_estimate,
            gross_profit,
            gross_margin_pct,
            is_closed,
            account_number,
            account_name,
            revrecstartdate,
            revrecenddate
          )
        `)
        .in('netsuite_id', Array.from(linkedSOIds));

      if (nsSOs) {
        for (const so of nsSOs) {
          // Filter out NetSuite metadata lines (subtotals, tax groups, comments, taxes)
          const validLines = (so.netsuite_sales_order_lines || []).filter((line: any) => {
            const itemName = line.item_name || '';
            const itemType = line.item_type || '';
            const accountNumber = line.account_number || '';
            // Exclude: Subtotal, -Not Taxable-, tax groups, and comment lines
            if (itemName === 'Subtotal') return false;
            if (itemName === 'Comment') return false;
            if (itemName.startsWith('-Not Taxable-')) return false;
            if (itemType === 'TaxGroup') return false;
            if (itemType === 'Subtotal') return false;
            if (itemType === 'Description') return false; // Comment lines
            // Exclude tax lines (account 2050 = Sales Taxes Payable)
            if (accountNumber === '2050') return false;
            // Only include revenue line items (those with account numbers)
            if (!line.account_number) return false;
            return true;
          });

          // Enhance line items with product type and filter by allowed types
          const enhancedLines: EnhancedSOLineItem[] = validLines
            .map((line: any) => {
              const accountNumber = line.account_number || null;
              const itemClassName = line.item_class_name || null;
              const productType = parseProjectType(accountNumber, line.account_name, itemClassName);

              return {
                lineNumber: line.line_number || 0,
                itemId: line.item_id || '',
                itemName: line.item_name,
                itemDescription: line.item_description,
                itemType: line.item_type,
                quantity: line.quantity || 0,
                rate: line.rate || 0,
                amount: line.amount || 0,
                costEstimate: line.cost_estimate || 0,
                grossProfit: line.gross_profit || 0,
                grossMarginPct: line.gross_margin_pct || 0,
                isClosed: line.is_closed || false,
                accountNumber,
                accountName: line.account_name,
                productType,
                revRecStartDate: line.revrecstartdate || null,
                revRecEndDate: line.revrecenddate || null,
            };
          })
          .filter(line => {
            // CRITICAL: Only include SO line items that match the engagement period
            // Primary filter: Use revenue recognition dates if available
            // Fallback: Use WO item_id matching

            // Build engagement month date range if year/month provided
            if (year && month) {
              const engagementStart = new Date(year, month - 1, 1); // month is 1-indexed
              const engagementEnd = new Date(year, month, 0); // Last day of month

              const revRecStart = line.revRecStartDate ? new Date(line.revRecStartDate) : null;
              const revRecEnd = line.revRecEndDate ? new Date(line.revRecEndDate) : null;

              // If line has rev rec dates, check for overlap with engagement month
              if (revRecStart && revRecEnd) {
                const overlaps = revRecStart <= engagementEnd && revRecEnd >= engagementStart;
                return overlaps;
              }
            }

            // Fallback to WO item_id filtering
            if (workOrderItemIds.size === 0) {
              // If no WO item_ids found, use alternative filtering by account number for MCC
              const acct = line.accountNumber || '';
              return acct.startsWith('410') || acct.startsWith('411');
            }
            return workOrderItemIds.has(line.itemId);
          });

          // Second pass: Find matched account numbers and include the LARGEST credit per account
          // This handles cases where credits/adjustments aren't in the WO but should offset matched revenue
          // We only take the largest credit to avoid including credits from other engagement periods
          const matchedAccounts = new Set<string>();
          for (const line of enhancedLines) {
            if (line.accountNumber) matchedAccounts.add(line.accountNumber);
          }

          // Find ALL potential credit lines per account, then pick the largest
          const creditsByAccount = new Map<string, any>();
          for (const line of validLines) {
            const accountNumber = line.account_number || '';
            const amount = line.amount || 0;
            const isCredit = amount > 0;
            const sameAccount = matchedAccounts.has(accountNumber);
            const alreadyIncluded = enhancedLines.some((el: any) => el.lineNumber === line.line_number);

            if (isCredit && sameAccount && !alreadyIncluded) {
              const existing = creditsByAccount.get(accountNumber);
              if (!existing || amount > existing.amount) {
                creditsByAccount.set(accountNumber, line);
              }
            }
          }

          // Add the largest credit per account
          for (const [acct, line] of creditsByAccount) {
            const accountNumber = line.account_number || null;
            const itemClassName = line.item_class_name || null;
            const productType = parseProjectType(accountNumber, line.account_name, itemClassName);
            const creditLine = {
              lineNumber: line.line_number || 0,
              itemId: line.item_id || '',
              itemName: line.item_name,
              itemDescription: line.item_description,
              itemType: line.item_type,
              quantity: line.quantity || 0,
              rate: line.rate || 0,
              amount: line.amount || 0,
              costEstimate: line.cost_estimate || 0,
              grossProfit: line.gross_profit || 0,
              grossMarginPct: line.gross_margin_pct || 0,
              isClosed: line.is_closed || false,
              accountNumber,
              accountName: line.account_name,
              productType,
              revRecStartDate: line.revrecstartdate || null,
              revRecEndDate: line.revrecenddate || null,
            };
            enhancedLines.push(creditLine);
          }

          // Group lines by product type
          const productTypeMap = new Map<string, EnhancedSOLineItem[]>();
          for (const line of enhancedLines) {
            const existing = productTypeMap.get(line.productType) || [];
            existing.push(line);
            productTypeMap.set(line.productType, existing);
          }

          // Create product type groups with totals
          const productTypeGroups: ProductTypeGroup[] = Array.from(productTypeMap.entries()).map(([productType, lineItems]) => {
            // Sort line items by rate descending (highest rate first)
            const sortedLineItems = [...lineItems].sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));

            // Use absolute values since NetSuite may store negative amounts
            const revenue = Math.abs(lineItems.reduce((sum, li) => sum + li.amount, 0));
            const costEstimate = Math.abs(lineItems.reduce((sum, li) => sum + li.costEstimate, 0));
            const grossProfit = revenue - costEstimate;

            return {
              productType,
              productTypeName: PRODUCT_TYPE_NAMES[productType] || productType,
              lineItems: sortedLineItems,
              totals: {
                lineItemCount: lineItems.length,
                revenue,
                costEstimate,
                grossProfit,
                grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
              },
            };
          });

          // Sort groups by revenue descending
          productTypeGroups.sort((a, b) => b.totals.revenue - a.totals.revenue);

          // Calculate SO totals from filtered line items (excludes tax)
          // Use absolute values since NetSuite stores some amounts as negative
          const soRevenue = Math.abs(enhancedLines.reduce((sum, li) => sum + li.amount, 0));
          const soCostEstimate = Math.abs(enhancedLines.reduce((sum, li) => sum + li.costEstimate, 0));
          const soGrossProfit = soRevenue - soCostEstimate;

          // Create rollup validation
          const productTypeBreakdown = productTypeGroups.map(g => ({
            type: g.productType,
            total: Math.abs(g.totals.revenue), // Use absolute value for product type totals too
          }));

          const lineItemsTotal = Math.abs(enhancedLines.reduce((sum, li) => sum + li.amount, 0));
          const expectedTotal = lineItemsTotal; // Use filtered line items total (excludes tax)
          const variance = lineItemsTotal - expectedTotal;
          const variancePct = expectedTotal > 0 ? Math.abs(variance / expectedTotal) * 100 : 0;

          salesOrders.push({
            soNumber: so.so_number,
            netsuiteId: so.netsuite_id,
            soDate: so.so_date,
            status: so.status,
            customerName: so.customer_name,
            totalAmount: soRevenue, // Use calculated revenue (excludes tax)
            productTypeGroups,
            rollupValidation: {
              productTypeBreakdown,
              lineItemsTotal,
              expectedTotal,
              variance,
              variancePct,
              valid: variancePct < 1, // <1% variance is valid
            },
            totals: {
              lineItemCount: enhancedLines.length,
              revenue: soRevenue,
              costEstimate: soCostEstimate,
              grossProfit: soGrossProfit,
              grossMarginPct: soRevenue > 0 ? (soGrossProfit / soRevenue) * 100 : 0,
            },
          });
        }
      }
    }

    // STEP 5: Calculate project-level KPIs
    const netsuiteRevenue = salesOrders.reduce((sum, so) => sum + so.totals.revenue, 0);
    const netsuiteCostEstimate = salesOrders.reduce((sum, so) => sum + so.totals.costEstimate, 0);

    // Use actual WO costs if available
    const woActualCosts = workOrders.filter(wo => wo.totals.totalActualCost !== null);
    const netsuiteActualCost = woActualCosts.length > 0
      ? workOrders.reduce((sum, wo) => sum + (wo.totals.totalActualCost || 0), 0)
      : netsuiteCostEstimate;

    const effectiveCost = woActualCosts.length > 0 ? netsuiteActualCost : netsuiteCostEstimate;
    const grossProfit = netsuiteRevenue - effectiveCost;
    const grossMarginPct = netsuiteRevenue > 0 ? (grossProfit / netsuiteRevenue) * 100 : 0;
    const cpi = actualCost > 0 ? budgetCost / actualCost : 1;

    // STEP 6: Get sync status
    const { data: syncData } = await supabase
      .from('netsuite_work_orders')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1);

    const { count: woCount } = await supabase
      .from('netsuite_work_orders')
      .select('id', { count: 'exact', head: true });

    const { count: soCount } = await supabase
      .from('netsuite_sales_orders')
      .select('id', { count: 'exact', head: true });

    const response: ProjectProfitabilityResponse = {
      project: {
        name: projectName,
        year,
        month,
        projectType,
        customerName: salesOrders[0]?.customerName || null,
      },
      kpis: {
        revenue: netsuiteRevenue,
        cost: effectiveCost,
        grossProfit,
        grossMarginPct,
        cpi,
        budgetRevenue,
        budgetCost,
        actualRevenue,
        actualCost,
      },
      salesOrders: salesOrders.sort((a, b) => b.totals.revenue - a.totals.revenue),
      workOrders: workOrders.sort((a, b) => b.totals.totalCost - a.totals.totalCost),
      syncStatus: {
        lastSyncedAt: syncData?.[0]?.synced_at || null,
        workOrderCount: woCount || 0,
        salesOrderCount: soCount || 0,
        dataSource: useWipReport ? 'wip-report' : 'database',
        budgetSource,
        note: useWipReport
          ? 'Using NetSuite WIP reports for real-time cost data'
          : 'Using synced database for cost data (recommended for closed projects)',
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Profitability API error:', error);
    return NextResponse.json({
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
