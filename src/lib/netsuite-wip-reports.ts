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
        params: { limit: '5000' },
      }
    );

    return response.items || [];
  } catch (error) {
    console.error('Error fetching WIP report detail:', error);
    throw error;
  }
}
