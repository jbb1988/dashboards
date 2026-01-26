/**
 * NetSuite WIP Report Queries
 *
 * These functions query the saved searches that generate the WIP reports used for cost tracking.
 *
 * Saved Search IDs:
 * - MARS WIP Report-TB Review (Summary): 1654
 * - MARS WIP Report-TB Review (Itemized Detail): 1963
 */

import { netsuiteRequest } from './netsuite';

export interface WIPReportSummary {
  customer: string;
  sales_order: string;
  work_order: string;
  item_number: string;
  item_description: string;
  quantity: number;
  revenue: number;
  labor_hours: number;
  labor_cost: number;
  expense_report_cost: number;
  material_cost: number;
  freight_cost: number;
  total_cost: number;
  gross_margin: number;
  gross_margin_pct: number;
}

export interface WIPReportDetail {
  transaction_date: string;
  wo_status: string;
  customer: string;
  sales_order: string;
  work_order: string;
  item_number: string;
  item_description: string;
  item_costed: string;
  item_costed_description: string;
  memo: string;
  quantity_costed: number;
  quantity: number;
  revenue: number;
  labor_hours: number;
  labor_cost: number;
  expense_report_cost: number;
  material_cost: number;
  freight_cost: number;
  total_cost: number;
  gross_margin: number;
  gross_margin_pct: number;
}

/**
 * Query WIP Report Summary (Search ID: 1654)
 * Shows rolled-up costs per work order
 */
export async function getWIPReportSummary(filters?: {
  customer?: string;
  salesOrder?: string;
  workOrder?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<WIPReportSummary[]> {
  try {
    // Build the query to recreate the saved search logic
    // Based on the formulas provided, we're calculating costs from work order line items

    let whereClause = "WHERE wo.type = 'WorkOrd'";

    if (filters?.customer) {
      whereClause += ` AND c.entityid = '${filters.customer}'`;
    }
    if (filters?.salesOrder) {
      whereClause += ` AND so.tranid = '${filters.salesOrder}'`;
    }
    if (filters?.workOrder) {
      whereClause += ` AND wo.tranid = '${filters.workOrder}'`;
    }
    if (filters?.dateFrom) {
      whereClause += ` AND wo.trandate >= '${filters.dateFrom}'`;
    }
    if (filters?.dateTo) {
      whereClause += ` AND wo.trandate <= '${filters.dateTo}'`;
    }

    const query = `
      SELECT
        c.entityid AS customer,
        so.tranid AS sales_order,
        wo.tranid AS work_order,
        i.itemid AS item_number,
        wo.custbody15 AS item_description,

        -- Quantities and revenue
        MAX(wol.quantity) AS quantity,
        MAX(so.custbody2) AS revenue,

        -- Labor Hours (sum of labor item quantities)
        SUM(CASE
          WHEN wol.item IN (
            SELECT id FROM item WHERE displayname IN (
              'Maintenance Calibration / Certification Labor',
              'Assembly Labor', 'Electrical Labor', 'Fab Labor', 'Fab Tank Labor',
              'CA Maintenance Calibration / Certification Labor',
              'Hardware Install & Training Labor', 'Crating & Shipping Labor',
              'Service Call Labor', 'Software Install & Training Labor',
              'Saw Labor', 'Test Labor'
            )
          ) THEN ABS(wol.quantity)
          ELSE 0
        END) AS labor_hours,

        -- Labor $ (sum of labor + overhead items)
        SUM(CASE
          WHEN wol.item IN (
            SELECT id FROM item WHERE displayname IN (
              'Maintenance Calibration / Certification Labor',
              'Assembly Labor', 'Electrical Labor', 'Fab Labor', 'Fab Tank Labor',
              'Hardware Install & Training Labor', 'Crating & Shipping Labor',
              'Service Call Labor', 'Software Install & Training Labor',
              'Saw Labor', 'Test Labor',
              'Assembly Overhead', 'Crating & Shipping Overhead',
              'Electrical Overhead', 'Fab Overhead', 'Fab Tank Overhead',
              'Hardware Install & Training Overhead',
              'Maintenance Calibration / Certification Overhead',
              'CA Maintenance Calibration / Certification Labor',
              'Saw Overhead', 'Service Call Overhead',
              'Overhead - Software Install & Training', 'Test OH'
            )
          ) THEN ABS(wol.amount)
          ELSE 0
        END) AS labor_cost,

        -- Expense Report $
        SUM(CASE
          WHEN wol.item IN (
            SELECT id FROM item WHERE displayname IN (
              'Test Bench Expense Report',
              'Test Bench Outside Services'
            )
          ) THEN ABS(wol.amount)
          ELSE 0
        END) AS expense_report_cost,

        -- Material $
        SUM(CASE
          WHEN i.type IN ('Assembly', 'InvtPart', 'NonInvtPart')
            OR wol.item IN (
              SELECT id FROM item WHERE displayname IN (
                'Test Bench Misc Material',
                'Non Stock Purchases'
              )
            )
          THEN ABS(wol.amount)
          ELSE 0
        END) AS material_cost,

        -- Freight $
        SUM(CASE
          WHEN wol.item IN (
            SELECT id FROM item WHERE displayname IN (
              'Test Bench Crating & Shipping-FREIGHT',
              'Test Bench Crating & Shipping-MATERIAL'
            )
          ) THEN ABS(wol.amount)
          ELSE 0
        END) AS freight_cost,

        -- Total Cost
        SUM(ABS(wol.amount)) AS total_cost,

        -- Gross Margin
        (MAX(so.custbody2) - SUM(ABS(wol.amount))) AS gross_margin,

        -- Gross Margin %
        CASE
          WHEN MAX(so.custbody2) != 0
          THEN ((MAX(so.custbody2) - SUM(ABS(wol.amount))) / MAX(so.custbody2)) * 100
          ELSE 0
        END AS gross_margin_pct

      FROM transaction wo
      INNER JOIN transactionline wol ON wo.id = wol.transaction
      LEFT JOIN transaction so ON wo.createdfrom = so.id
      LEFT JOIN customer c ON wo.entity = c.id
      LEFT JOIN item i ON wol.item = i.id

      ${whereClause}

      GROUP BY c.entityid, so.tranid, wo.tranid, i.itemid, wo.custbody15
      ORDER BY wo.trandate DESC, wo.tranid
    `;

    const response = await netsuiteRequest<{ items: WIPReportSummary[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '1000' },
      }
    );

    return response.items || [];
  } catch (error) {
    console.error('Error fetching WIP report summary:', error);
    throw error;
  }
}

// =============================================================================
// MANUFACTURING OPERATIONS (Work Order Routing)
// =============================================================================

export interface WorkOrderOperation {
  work_order_id: string;
  work_order: string;
  customer_id: string | null;
  customer_name: string | null;
  operation_sequence: number;
  operation_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  completed_quantity: number | null;
  input_quantity: number | null;
  work_center: string | null;
  estimated_time: number | null;
  actual_time: number | null;
  labor_cost: number | null;
  machine_cost: number | null;
}

export interface WorkOrderWithOperations {
  work_order_id: string;
  work_order: string;
  wo_date: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  so_number: string | null;
  assembly_description: string | null;
  operations: WorkOrderOperation[];
  current_operation: WorkOrderOperation | null;
  total_operations: number;
  completed_operations: number;
  percent_complete: number;
  days_in_current_op: number | null;
  revenue: number | null;
  total_cost: number | null;
  margin_pct: number | null;
}

/**
 * Query Manufacturing Operations (Work Order Routing)
 *
 * Each Work Order can have routing operations (Op 10, Op 20, etc.) that represent
 * actual production stages tracked in ManufacturingOperationTask.
 *
 * NOTE: Requires NetSuite role permissions:
 * - Lists > Manufacturing > Manufacturing Operation Task → View
 * - Lists > Manufacturing > Manufacturing Routing → View
 * - Setup > SuiteQL → Full
 */
export async function getWorkOrderOperations(filters?: {
  workOrder?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<WorkOrderOperation[]> {
  try {
    let whereClause = "WHERE wo.type = 'WorkOrd'";

    if (filters?.workOrder) {
      whereClause += ` AND wo.tranid = '${filters.workOrder.replace(/'/g, "''")}'`;
    }
    if (filters?.status) {
      whereClause += ` AND mot.status = '${filters.status.replace(/'/g, "''")}'`;
    }
    if (filters?.dateFrom) {
      const [y, m, d] = filters.dateFrom.split('-');
      whereClause += ` AND wo.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
    }
    if (filters?.dateTo) {
      const [y, m, d] = filters.dateTo.split('-');
      whereClause += ` AND wo.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
    }

    const query = `
      SELECT
        wo.id AS work_order_id,
        wo.tranid AS work_order,
        wo.entity AS customer_id,
        BUILTIN.DF(wo.entity) AS customer_name,
        mot.operationsequence AS operation_sequence,
        mot.title AS operation_name,
        mot.status,
        mot.startdatetime AS start_date,
        mot.enddate AS end_date,
        mot.completedquantity AS completed_quantity,
        mot.inputquantity AS input_quantity,
        BUILTIN.DF(mot.manufacturingworkcenter) AS work_center,
        mot.setuptime AS estimated_time,
        mot.actualsetuptime AS actual_time,
        mot.runrate AS labor_cost,
        mot.machineresources AS machine_cost
      FROM manufacturingOperationTask mot
      INNER JOIN Transaction wo ON mot.workorder = wo.id
      ${whereClause}
      ORDER BY wo.tranid, mot.operationsequence
    `;

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '1000' },
      }
    );

    return (response.items || []).map(row => ({
      work_order_id: row.work_order_id?.toString() || '',
      work_order: row.work_order || '',
      customer_id: row.customer_id?.toString() || null,
      customer_name: row.customer_name || null,
      operation_sequence: parseInt(row.operation_sequence) || 0,
      operation_name: row.operation_name || '',
      status: row.status || '',
      start_date: row.start_date || null,
      end_date: row.end_date || null,
      completed_quantity: row.completed_quantity !== null ? parseFloat(row.completed_quantity) : null,
      input_quantity: row.input_quantity !== null ? parseFloat(row.input_quantity) : null,
      work_center: row.work_center || null,
      estimated_time: row.estimated_time !== null ? parseFloat(row.estimated_time) : null,
      actual_time: row.actual_time !== null ? parseFloat(row.actual_time) : null,
      labor_cost: row.labor_cost !== null ? parseFloat(row.labor_cost) : null,
      machine_cost: row.machine_cost !== null ? parseFloat(row.machine_cost) : null,
    }));
  } catch (error) {
    console.error('Error fetching work order operations:', error);
    throw error;
  }
}

/**
 * Get Work Orders with Operations - Combined view
 *
 * Fetches work orders and their manufacturing operations, combining with WIP cost data
 * for a complete operational dashboard view.
 */
export async function getWorkOrdersWithOperations(filters?: {
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<WorkOrderWithOperations[]> {
  const { limit = 500 } = filters || {};

  try {
    // Build date filter
    let dateFilter = '';
    if (filters?.dateFrom) {
      const [y, m, d] = filters.dateFrom.split('-');
      dateFilter += ` AND wo.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
    }
    if (filters?.dateTo) {
      const [y, m, d] = filters.dateTo.split('-');
      dateFilter += ` AND wo.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
    }

    // Build status filter (for active WOs)
    let statusFilter = '';
    if (filters?.status && filters.status.length > 0) {
      const statuses = filters.status.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
      statusFilter = ` AND wo.status IN (${statuses})`;
    }

    // First, fetch work orders with basic info
    const woQuery = `
      SELECT
        wo.id AS work_order_id,
        wo.tranid AS work_order,
        wo.trandate AS wo_date,
        wo.status,
        wo.entity AS customer_id,
        BUILTIN.DF(wo.entity) AS customer_name,
        so.tranid AS so_number,
        wo.custbodyiqsassydescription AS assembly_description
      FROM Transaction wo
      INNER JOIN TransactionLine woline ON woline.transaction = wo.id AND woline.mainline = 'T'
      LEFT JOIN Transaction so ON so.id = woline.createdfrom
      WHERE wo.type = 'WorkOrd'
        ${dateFilter}
        ${statusFilter}
      ORDER BY wo.trandate DESC
    `;

    console.log('Fetching work orders for operations dashboard...');
    const woResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: woQuery },
        params: { limit: limit.toString() },
      }
    );

    const workOrders = woResponse.items || [];
    console.log(`Found ${workOrders.length} work orders`);

    if (workOrders.length === 0) {
      return [];
    }

    // Fetch all operations for these work orders
    const woIds = workOrders.map(wo => `'${wo.work_order_id}'`).join(',');
    const opsQuery = `
      SELECT
        mot.workorder AS work_order_id,
        mot.operationsequence AS operation_sequence,
        mot.title AS operation_name,
        mot.status,
        mot.startdatetime AS start_date,
        mot.enddate AS end_date,
        mot.completedquantity AS completed_quantity,
        mot.inputquantity AS input_quantity,
        BUILTIN.DF(mot.manufacturingworkcenter) AS work_center,
        mot.setuptime AS estimated_time,
        mot.actualsetuptime AS actual_time
      FROM manufacturingOperationTask mot
      WHERE mot.workorder IN (${woIds})
      ORDER BY mot.workorder, mot.operationsequence
    `;

    console.log('Fetching operations for work orders...');
    const opsResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: opsQuery },
        params: { limit: '1000' },
      }
    );

    const operations = opsResponse.items || [];
    console.log(`Found ${operations.length} operations`);

    // Group operations by work order
    const operationsByWO = new Map<string, WorkOrderOperation[]>();
    for (const op of operations) {
      const woId = op.work_order_id?.toString() || '';
      if (!operationsByWO.has(woId)) {
        operationsByWO.set(woId, []);
      }
      operationsByWO.get(woId)!.push({
        work_order_id: woId,
        work_order: '', // Will be filled from WO data
        customer_id: null,
        customer_name: null,
        operation_sequence: parseInt(op.operation_sequence) || 0,
        operation_name: op.operation_name || '',
        status: op.status || '',
        start_date: op.start_date || null,
        end_date: op.end_date || null,
        completed_quantity: op.completed_quantity !== null ? parseFloat(op.completed_quantity) : null,
        input_quantity: op.input_quantity !== null ? parseFloat(op.input_quantity) : null,
        work_center: op.work_center || null,
        estimated_time: op.estimated_time !== null ? parseFloat(op.estimated_time) : null,
        actual_time: op.actual_time !== null ? parseFloat(op.actual_time) : null,
        labor_cost: null,
        machine_cost: null,
      });
    }

    // Combine work orders with their operations
    const result: WorkOrderWithOperations[] = workOrders.map(wo => {
      const woId = wo.work_order_id?.toString() || '';
      const woOps = operationsByWO.get(woId) || [];

      // Calculate metrics
      const totalOps = woOps.length;
      const completedOps = woOps.filter(op =>
        op.status === 'COMPLETE' || op.status === 'Complete' || op.status === 'Completed'
      ).length;
      const percentComplete = totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0;

      // Find current operation (highest sequence that's in progress or first pending)
      const inProgressOps = woOps.filter(op =>
        op.status === 'IN_PROGRESS' || op.status === 'In Progress' || op.status === 'InProgress'
      );
      const pendingOps = woOps.filter(op =>
        op.status === 'PENDING' || op.status === 'Pending' || op.status === 'Not Started'
      );

      const currentOp = inProgressOps.length > 0
        ? inProgressOps.reduce((a, b) => a.operation_sequence > b.operation_sequence ? a : b)
        : pendingOps.length > 0
          ? pendingOps.reduce((a, b) => a.operation_sequence < b.operation_sequence ? a : b)
          : null;

      // Calculate days in current operation
      let daysInCurrentOp: number | null = null;
      if (currentOp?.start_date) {
        const startDate = new Date(currentOp.start_date);
        const today = new Date();
        daysInCurrentOp = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        work_order_id: woId,
        work_order: wo.work_order || '',
        wo_date: wo.wo_date || null,
        status: wo.status || null,
        customer_id: wo.customer_id?.toString() || null,
        customer_name: wo.customer_name || null,
        so_number: wo.so_number || null,
        assembly_description: wo.assembly_description || null,
        operations: woOps,
        current_operation: currentOp,
        total_operations: totalOps,
        completed_operations: completedOps,
        percent_complete: percentComplete,
        days_in_current_op: daysInCurrentOp,
        revenue: null, // Will be populated from WIP summary if available
        total_cost: null,
        margin_pct: null,
      };
    });

    console.log(`Returning ${result.length} work orders with operations`);
    return result;
  } catch (error) {
    console.error('Error fetching work orders with operations:', error);
    throw error;
  }
}

/**
 * Query WIP Report Detailed (Search ID: 1963)
 * Shows itemized line-by-line cost detail
 */
export async function getWIPReportDetail(filters?: {
  customer?: string;
  workOrder?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<WIPReportDetail[]> {
  try {
    let whereClause = "WHERE wo.type = 'WorkOrd'";

    if (filters?.customer) {
      whereClause += ` AND c.entityid = '${filters.customer}'`;
    }
    if (filters?.workOrder) {
      whereClause += ` AND wo.tranid = '${filters.workOrder}'`;
    }
    if (filters?.dateFrom) {
      whereClause += ` AND wo.trandate >= '${filters.dateFrom}'`;
    }
    if (filters?.dateTo) {
      whereClause += ` AND wo.trandate <= '${filters.dateTo}'`;
    }

    const query = `
      SELECT
        wo.trandate AS transaction_date,
        wo.status AS wo_status,
        c.entityid AS customer,
        so.tranid AS sales_order,
        wo.tranid AS work_order,
        pi.itemid AS item_number,
        wo.custbody15 AS item_description,
        i.itemid AS item_costed,
        i.displayname AS item_costed_description,
        wol.memo,
        wol.quantity AS quantity_costed,
        MAX(pwol.quantity) AS quantity,
        MAX(so.custbody2) AS revenue,

        -- Labor Hours
        CASE
          WHEN i.displayname IN (
            'Maintenance Calibration / Certification Labor',
            'Assembly Labor', 'Electrical Labor', 'Fab Labor', 'Fab Tank Labor',
            'CA Maintenance Calibration / Certification Labor',
            'Hardware Install & Training Labor', 'Crating & Shipping Labor',
            'Service Call Labor', 'Software Install & Training Labor',
            'Saw Labor', 'Test Labor'
          ) THEN ABS(wol.quantity)
          ELSE 0
        END AS labor_hours,

        -- Labor $
        CASE
          WHEN i.displayname IN (
            'Maintenance Calibration / Certification Labor',
            'Assembly Labor', 'Electrical Labor', 'Fab Labor', 'Fab Tank Labor',
            'Hardware Install & Training Labor', 'Crating & Shipping Labor',
            'Service Call Labor', 'Software Install & Training Labor',
            'Saw Labor', 'Test Labor',
            'Assembly Overhead', 'Crating & Shipping Overhead',
            'Electrical Overhead', 'Fab Overhead', 'Fab Tank Overhead',
            'Hardware Install & Training Overhead',
            'Maintenance Calibration / Certification Overhead',
            'CA Maintenance Calibration / Certification Labor',
            'Saw Overhead', 'Service Call Overhead',
            'Overhead - Software Install & Training', 'Test OH'
          ) THEN ABS(wol.amount)
          ELSE 0
        END AS labor_cost,

        -- Expense Report $
        CASE
          WHEN i.displayname IN (
            'Test Bench Expense Report',
            'Test Bench Outside Services'
          ) THEN ABS(wol.amount)
          ELSE 0
        END AS expense_report_cost,

        -- Material $
        CASE
          WHEN i.type IN ('Assembly', 'InvtPart', 'NonInvtPart')
            OR i.displayname IN (
              'Test Bench Misc Material',
              'Non Stock Purchases'
            )
          THEN ABS(wol.amount)
          ELSE 0
        END AS material_cost,

        -- Freight $
        CASE
          WHEN i.displayname IN (
            'Test Bench Crating & Shipping-FREIGHT',
            'Test Bench Crating & Shipping-MATERIAL'
          ) THEN ABS(wol.amount)
          ELSE 0
        END AS freight_cost,

        -- Total Cost (line level)
        ABS(wol.amount) AS total_cost

      FROM transaction wo
      INNER JOIN transactionline wol ON wo.id = wol.transaction
      LEFT JOIN transaction so ON wo.createdfrom = so.id
      LEFT JOIN transactionline pwol ON so.id = pwol.transaction AND pwol.mainline = 'F'
      LEFT JOIN customer c ON wo.entity = c.id
      LEFT JOIN item i ON wol.item = i.id
      LEFT JOIN item pi ON pwol.item = pi.id

      ${whereClause}

      GROUP BY wo.trandate, wo.status, c.entityid, so.tranid, wo.tranid,
               pi.itemid, wo.custbody15, i.itemid, i.displayname, i.type,
               wol.memo, wol.quantity, wol.amount, wol.linesequencenumber
      ORDER BY wo.trandate DESC, wo.tranid, wol.linesequencenumber
    `;

    const response = await netsuiteRequest<{ items: WIPReportDetail[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '1000' },
      }
    );

    return response.items || [];
  } catch (error) {
    console.error('Error fetching WIP report detail:', error);
    throw error;
  }
}
