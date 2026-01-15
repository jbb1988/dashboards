/**
 * NetSuite API Integration
 * Uses Token-Based Authentication (TBA) with OAuth 1.0 style signatures
 */

import crypto from 'crypto';

// NetSuite configuration
const config = {
  accountId: process.env.NETSUITE_ACCOUNT_ID || '',
  consumerKey: process.env.NETSUITE_CONSUMER_KEY || '',
  consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || '',
  tokenId: process.env.NETSUITE_TOKEN_ID || '',
  tokenSecret: process.env.NETSUITE_TOKEN_SECRET || '',
};

/**
 * Generate OAuth 1.0 signature for NetSuite TBA
 */
function generateOAuthSignature(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  queryParams?: Record<string, string>,
  signatureMethod: 'HMAC-SHA256' | 'HMAC-SHA1' = 'HMAC-SHA256'
): string {
  // Combine OAuth params and query params for signature
  const allParams: Record<string, string> = { ...oauthParams };
  if (queryParams) {
    Object.assign(allParams, queryParams);
  }

  // Sort parameters alphabetically and encode
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // Create signing key (consumer secret & token secret)
  const signingKey = `${encodeURIComponent(config.consumerSecret)}&${encodeURIComponent(config.tokenSecret)}`;

  // Generate signature based on method
  const algorithm = signatureMethod === 'HMAC-SHA256' ? 'sha256' : 'sha1';
  const signature = crypto
    .createHmac(algorithm, signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
}

/**
 * Generate OAuth Authorization header for NetSuite
 */
function generateAuthHeader(
  method: string,
  baseUrl: string,
  queryParams?: Record<string, string>
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Use alphanumeric nonce
  const nonce = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '');

  // HMAC-SHA256 is required (HMAC-SHA1 deprecated since 2023.1)
  const signatureMethod = 'HMAC-SHA256';

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_token: config.tokenId,
    oauth_signature_method: signatureMethod,
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
  };

  // Generate signature (include query params in signature base)
  const signature = generateOAuthSignature(method, baseUrl, oauthParams, queryParams, signatureMethod);
  oauthParams.oauth_signature = signature;

  // Build Authorization header (only OAuth params, not query params)
  const authHeader = Object.keys(oauthParams)
    .map((key) => `${key}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  // Realm is the account ID (as-is, no transformation needed for numeric IDs)
  const realm = config.accountId;

  return `OAuth realm="${realm}", ${authHeader}`;
}

/**
 * Get NetSuite REST API base URL
 */
function getBaseUrl(): string {
  // NetSuite REST API URL format: https://{accountId}.suitetalk.api.netsuite.com
  const accountId = config.accountId.toLowerCase();
  return `https://${accountId}.suitetalk.api.netsuite.com`;
}

/**
 * Make authenticated request to NetSuite REST API
 */
export async function netsuiteRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, params } = options;

  // Base URL without query params (used for signature)
  const baseUrl = `${getBaseUrl()}${endpoint}`;

  // Generate auth header with query params included in signature
  const authHeader = generateAuthHeader(method, baseUrl, params);

  // Build full URL with query parameters
  let url = baseUrl;
  if (params && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url = `${url}?${queryString}`;
  }

  const headers: Record<string, string> = {
    Authorization: authHeader,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // SuiteQL requires Prefer header
  if (endpoint.includes('suiteql')) {
    headers['Prefer'] = 'transient';
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  console.log('NetSuite request:', { url, method });

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('NetSuite API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(`NetSuite API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Types for NetSuite records
export interface NetSuiteCustomer {
  id: string;
  entityId: string;
  companyName: string;
  email?: string;
  phone?: string;
  balance?: number;
  creditLimit?: number;
  terms?: { id: string; refName: string };
  subsidiary?: { id: string; refName: string };
  dateCreated?: string;
  lastModifiedDate?: string;
}

export interface NetSuitePurchaseOrder {
  id: string;
  tranId: string;
  tranDate: string;
  status: { id: string; refName: string };
  entity: { id: string; refName: string }; // Vendor
  total: number;
  currency?: { id: string; refName: string };
  subsidiary?: { id: string; refName: string };
  memo?: string;
  items?: Array<{
    item: { id: string; refName: string };
    quantity: number;
    rate: number;
    amount: number;
  }>;
}

export interface NetSuiteSalesOrder {
  id: string;
  tranId: string;
  tranDate: string;
  status: { id: string; refName: string };
  entity: { id: string; refName: string }; // Customer
  total: number;
  currency?: { id: string; refName: string };
  subsidiary?: { id: string; refName: string };
  memo?: string;
}

export interface NetSuiteInvoice {
  id: string;
  tranId: string;
  tranDate: string;
  postingPeriod?: { id: string; refName: string };
  status: { id: string; refName: string };
  entity: { id: string; refName: string }; // Customer
  total: number;
  currency?: { id: string; refName: string };
  subsidiary?: { id: string; refName: string };
  class?: { id: string; refName: string };
  account?: { id: string; refName: string };
  memo?: string;
  item?: {
    items: Array<{
      item: { id: string; refName: string };
      class?: { id: string; refName: string };
      quantity: number;
      rate: number;
      amount: number;
      costEstimate?: number;
      description?: string;
      line: number;
    }>;
  };
}

export interface DiversifiedSaleRecord {
  netsuiteTransactionId: string;
  netsuiteLineId: string;
  transactionType: string;
  transactionNumber: string;
  transactionDate: string;
  postingPeriod: string;
  year: number;
  month: number;
  classId: string;
  className: string;
  classCategory: string;
  parentClass: string;
  customerId: string;
  customerName: string;
  accountId: string;
  accountName: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossProfitPct: number;
  itemId: string;
  itemName: string;
  itemDescription: string;
}

interface NetSuiteListResponse<T> {
  links: Array<{ rel: string; href: string }>;
  count: number;
  hasMore: boolean;
  items: T[];
  offset: number;
  totalResults: number;
}

/**
 * Fetch customers from NetSuite
 */
export async function getCustomers(options: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<{ customers: NetSuiteCustomer[]; total: number; hasMore: boolean }> {
  const params: Record<string, string> = {
    limit: (options.limit || 100).toString(),
    offset: (options.offset || 0).toString(),
  };

  if (options.q) {
    params.q = options.q;
  }

  const response = await netsuiteRequest<NetSuiteListResponse<NetSuiteCustomer>>(
    '/services/rest/record/v1/customer',
    { params }
  );

  return {
    customers: response.items || [],
    total: response.totalResults,
    hasMore: response.hasMore,
  };
}

/**
 * Fetch a single customer by ID
 */
export async function getCustomer(id: string): Promise<NetSuiteCustomer> {
  return netsuiteRequest<NetSuiteCustomer>(`/services/rest/record/v1/customer/${id}`);
}

/**
 * Fetch purchase orders from NetSuite
 */
export async function getPurchaseOrders(options: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<{ purchaseOrders: NetSuitePurchaseOrder[]; total: number; hasMore: boolean }> {
  const params: Record<string, string> = {
    limit: (options.limit || 100).toString(),
    offset: (options.offset || 0).toString(),
  };

  if (options.q) {
    params.q = options.q;
  }

  const response = await netsuiteRequest<NetSuiteListResponse<NetSuitePurchaseOrder>>(
    '/services/rest/record/v1/purchaseOrder',
    { params }
  );

  return {
    purchaseOrders: response.items || [],
    total: response.totalResults,
    hasMore: response.hasMore,
  };
}

/**
 * Fetch a single purchase order by ID
 */
export async function getPurchaseOrder(id: string): Promise<NetSuitePurchaseOrder> {
  return netsuiteRequest<NetSuitePurchaseOrder>(`/services/rest/record/v1/purchaseOrder/${id}`);
}

/**
 * Fetch sales orders from NetSuite
 */
export async function getSalesOrders(options: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<{ salesOrders: NetSuiteSalesOrder[]; total: number; hasMore: boolean }> {
  const params: Record<string, string> = {
    limit: (options.limit || 100).toString(),
    offset: (options.offset || 0).toString(),
  };

  if (options.q) {
    params.q = options.q;
  }

  const response = await netsuiteRequest<NetSuiteListResponse<NetSuiteSalesOrder>>(
    '/services/rest/record/v1/salesOrder',
    { params }
  );

  return {
    salesOrders: response.items || [],
    total: response.totalResults,
    hasMore: response.hasMore,
  };
}

/**
 * Fetch invoices from NetSuite (for diversified sales data)
 */
export async function getInvoices(options: {
  limit?: number;
  offset?: number;
  q?: string;
  expandSubResources?: boolean;
} = {}): Promise<{ invoices: NetSuiteInvoice[]; total: number; hasMore: boolean }> {
  const params: Record<string, string> = {
    limit: (options.limit || 100).toString(),
    offset: (options.offset || 0).toString(),
  };

  if (options.q) {
    params.q = options.q;
  }

  if (options.expandSubResources) {
    params.expandSubResources = 'true';
  }

  const response = await netsuiteRequest<NetSuiteListResponse<NetSuiteInvoice>>(
    '/services/rest/record/v1/invoice',
    { params }
  );

  return {
    invoices: response.items || [],
    total: response.totalResults,
    hasMore: response.hasMore,
  };
}

/**
 * Fetch a single invoice by ID with line item details
 */
export async function getInvoice(id: string): Promise<NetSuiteInvoice> {
  return netsuiteRequest<NetSuiteInvoice>(
    `/services/rest/record/v1/invoice/${id}`,
    { params: { expandSubResources: 'true' } }
  );
}

/**
 * Parse class name to extract category and parent
 * e.g., "Diversified Products : Strainers" -> { category: "Strainers", parent: "Diversified Products" }
 */
function parseClassName(className: string): { category: string; parent: string } {
  const parts = className.split(' : ').map(p => p.trim());
  if (parts.length >= 2) {
    return {
      parent: parts[0],
      category: parts[parts.length - 1],
    };
  }
  return {
    parent: className,
    category: className,
  };
}

/**
 * Fetch diversified sales data from NetSuite using SuiteQL
 * Queries TransactionLine filtered by Diversified Products class hierarchy
 */
export async function getDiversifiedSales(options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ records: DiversifiedSaleRecord[]; total: number; hasMore: boolean }> {
  const { limit = 1000, offset = 0 } = options;

  // Build date filter - NetSuite uses MM/DD/YYYY format
  let dateFilter = '';
  if (options.startDate) {
    // Convert YYYY-MM-DD to MM/DD/YYYY
    const [y, m, d] = options.startDate.split('-');
    dateFilter += ` AND t.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }
  if (options.endDate) {
    const [y, m, d] = options.endDate.split('-');
    dateFilter += ` AND t.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  // Query TransactionLine for customer/item detail
  // Filtered by Diversified Products class hierarchy
  // Note: Totals may vary ~5% from Income Statement due to GL adjustments
  const suiteQL = `
    SELECT
      t.id AS transaction_id,
      tl.id AS line_id,
      t.tranid,
      t.trandate,
      BUILTIN.DF(t.postingperiod) AS posting_period,
      BUILTIN.DF(t.entity) AS customer_name,
      t.entity AS customer_id,
      BUILTIN.DF(tl.class) AS class_name,
      tl.class AS class_id,
      tl.quantity,
      tl.netamount,
      tl.costestimate,
      BUILTIN.DF(tl.item) AS item_name,
      tl.item AS item_id,
      i.displayname AS item_description,
      t.type AS transaction_type,
      c.parent AS class_parent_id,
      BUILTIN.DF(c.parent) AS class_parent_name
    FROM Transaction t
    INNER JOIN TransactionLine tl ON tl.transaction = t.id
    LEFT JOIN Classification c ON c.id = tl.class
    LEFT JOIN Item i ON i.id = tl.item
    WHERE t.posting = 'T'
      AND tl.mainline = 'F'
      AND tl.item IS NOT NULL
      AND tl.netamount IS NOT NULL
      AND tl.netamount != 0
      AND (tl.class = 18 OR c.parent = 18 OR tl.class = 17)
      ${dateFilter}
    ORDER BY t.trandate DESC, t.id, tl.id
  `;

  try {
    console.log('Executing SuiteQL query for diversified sales...');
    console.log('Date filter:', options.startDate, 'to', options.endDate);

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean; totalResults: number }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: suiteQL },
        params: { limit: limit.toString(), offset: offset.toString() },
      }
    );

    console.log(`SuiteQL returned ${response.items?.length || 0} rows`);

    // Convert to records - group by transaction + line to avoid duplicates
    const grouped: Record<string, DiversifiedSaleRecord> = {};

    for (const row of response.items || []) {
      // Parse date - NetSuite returns MM/DD/YYYY format
      const dateParts = (row.trandate || '').split('/');
      let year = 2025;
      let month = 1;
      if (dateParts.length === 3) {
        month = parseInt(dateParts[0]) || 1;
        year = parseInt(dateParts[2]) || 2025;
      }

      const className = row.class_name || 'Diversified Products';
      const { category, parent } = parseClassName(className);

      // Revenue from TL netamount - negate since sales are stored as negative
      const netamount = parseFloat(row.netamount) || 0;
      const revenue = -netamount;
      const quantity = Math.abs(parseInt(row.quantity) || 0);
      // Cost from TransactionLine.costestimate (actual COGS)
      const costestimate = Math.abs(parseFloat(row.costestimate) || 0);

      // Group key by transaction + line to avoid duplicates
      const groupKey = `${row.transaction_id}-${row.line_id}`;

      // Determine parent class from hierarchy
      const parentClassName = row.class_parent_name || 'Diversified Products';

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          netsuiteTransactionId: row.transaction_id?.toString() || '',
          netsuiteLineId: row.line_id?.toString() || '',
          transactionType: row.transaction_type || 'CustInvc',
          transactionNumber: row.tranid || '',
          transactionDate: row.trandate || '',
          postingPeriod: row.posting_period || '',
          year,
          month,
          classId: row.class_id?.toString() || '',
          className,
          classCategory: category,
          parentClass: parentClassName,
          customerId: row.customer_id?.toString() || '',
          customerName: row.customer_name || '',
          accountId: '',  // Not used in this query
          accountName: '',  // Not used in this query
          quantity,
          revenue: 0,
          cost: 0,
          grossProfit: 0,
          grossProfitPct: 0,
          itemId: row.item_id?.toString() || '',
          itemName: row.item_name || '',
          itemDescription: row.item_description || '',
        };
      }

      // Add revenue (already positive from GL credit - debit)
      grouped[groupKey].revenue += revenue;
      // Cost should be positive for sales, negative for returns
      grouped[groupKey].cost += revenue >= 0 ? costestimate : -costestimate;
    }

    // Convert to array and calculate gross profit
    const records: DiversifiedSaleRecord[] = Object.values(grouped).map(r => {
      // Calculate actual gross profit from revenue and cost
      r.grossProfit = r.revenue - r.cost;
      r.grossProfitPct = r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0;
      return r;
    });

    // Log summary for validation
    const totalRevenue = records.reduce((sum, r) => sum + r.revenue, 0);
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const totalUnits = records.reduce((sum, r) => sum + r.quantity, 0);
    console.log(`Processed ${records.length} records`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`Total COGS: $${totalCost.toFixed(2)}`);
    console.log(`Total Units: ${totalUnits}`);

    return {
      records,
      total: response.totalResults || records.length,
      hasMore: response.hasMore || false,
    };
  } catch (error) {
    console.error('Error fetching diversified sales:', error);
    throw error;
  }
}

// Types for Project Profitability
export interface ProjectProfitabilityRecord {
  netsuiteTransactionId: string;
  netsuiteLineId: string;
  transactionNumber: string;
  transactionDate: string;
  postingPeriod: string;
  transactionType: string;
  year: number;
  month: number;
  customerId: string;
  customerName: string;
  classId: string;
  className: string;
  projectType: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  isRevenue: boolean;
  isCogs: boolean;
  amount: number;
  costestimate: number; // COGS from NetSuite costestimate field
  quantity: number;
  itemId: string;
  itemName: string;
}

/**
 * Parse project type from account number
 * Maps NetSuite account numbers to project types matching the Excel spreadsheet:
 * - TBEN: Test Bench Equipment New (4011, 5011)
 * - TBEU: Test Bench Equipment Upgrade (4012, 5012)
 * - TBIN: TB Install & Training New (4031, 5031)
 * - TBIU: TB Install & Training Upgrade (4032, 5032)
 * - M3IN: M3 Install New (4041, 5041)
 * - M3IU: M3 Install Upgrade (4042, 5042)
 * - M3SW: M3 Software (4051, 4080-4099, 5051, 5080-5099)
 * - MCC: MCC Services (4100-4111, 5100-5111)
 * - TBSV: TB Service/Maintenance (4071-4079, 5071-5079)
 */
function parseProjectType(accountNumber: string, accountName?: string): string {
  if (!accountNumber) return 'Unknown';

  const acct = accountNumber.trim();

  // Test Bench Equipment
  if (acct === '4011' || acct === '5011') return 'TBEN';
  if (acct === '4012' || acct === '5012') return 'TBEU';
  if (acct.startsWith('401') || acct.startsWith('501')) return 'TBEN'; // 4010, 4013-4019, etc.
  if (acct === '4021' || acct === '5021') return 'TB Components';

  // TB Install & Training
  if (acct === '4031' || acct === '5031') return 'TBIN';
  if (acct === '4032' || acct === '5032') return 'TBIU';
  if (acct.startsWith('403') || acct.startsWith('503')) return 'TBIN';

  // M3 Install & Training
  if (acct === '4041' || acct === '5041') return 'M3IN';
  if (acct === '4042' || acct === '5042') return 'M3IU';
  if (acct.startsWith('404') || acct.startsWith('504')) return 'M3IN';

  // M3 Software
  if (acct.startsWith('405') || acct.startsWith('505')) return 'M3 Software';
  if (acct.startsWith('408') || acct.startsWith('409') ||
      acct.startsWith('508') || acct.startsWith('509')) return 'M3 Software';

  // TB Service/Maintenance
  if (acct.startsWith('407') || acct.startsWith('507')) return 'TB Service';

  // MCC Services
  if (acct.startsWith('410') || acct.startsWith('411') ||
      acct.startsWith('510') || acct.startsWith('511')) return 'MCC';

  return 'Other';
}

/**
 * Fetch project profitability data from NetSuite using SuiteQL
 * Queries TransactionLine filtered by TB/MCC/TBEN classes and revenue/COGS accounts
 */
export async function getProjectProfitability(options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ records: ProjectProfitabilityRecord[]; total: number; hasMore: boolean }> {
  const { limit = 1000, offset = 0 } = options;

  // Build date filter - NetSuite uses MM/DD/YYYY format
  let dateFilter = '';
  if (options.startDate) {
    const [y, m, d] = options.startDate.split('-');
    dateFilter += ` AND t.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }
  if (options.endDate) {
    const [y, m, d] = options.endDate.split('-');
    dateFilter += ` AND t.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  // Query TransactionLine for Test Bench class ONLY (class_id = 1)
  // This filters out Diversified Products and brings in TB/MCC/M3 project data
  // Revenue from netamount on 4xxx accounts, COGS from costestimate field (like Diversified)
  // Query includes both CustInvc (mainline='F') and Journal (mainline='T') transactions
  // For JEs, customer is on line level (tl.entity), not header (t.entity)
  const suiteQL = `
    SELECT
      t.id AS transaction_id,
      tl.id AS line_id,
      t.tranid,
      t.trandate,
      BUILTIN.DF(t.postingperiod) AS posting_period,
      t.type AS transaction_type,
      COALESCE(t.entity, tl.entity) AS customer_id,
      COALESCE(BUILTIN.DF(t.entity), BUILTIN.DF(tl.entity)) AS customer_name,
      tl.class AS class_id,
      BUILTIN.DF(tl.class) AS class_name,
      tl.account AS account_id,
      a.acctnumber AS account_number,
      a.fullname AS account_name,
      a.accttype AS account_type,
      tl.netamount AS amount,
      tl.costestimate,
      tl.quantity,
      tl.item AS item_id,
      BUILTIN.DF(tl.item) AS item_name
    FROM Transaction t
    INNER JOIN TransactionLine tl ON tl.transaction = t.id
    LEFT JOIN Account a ON a.id = tl.account
    WHERE t.posting = 'T'
      AND ((tl.mainline = 'F' AND t.type != 'Journal') OR (tl.mainline = 'T' AND t.type = 'Journal'))
      AND tl.class = 1
      AND tl.netamount IS NOT NULL
      AND tl.netamount != 0
      AND a.acctnumber LIKE '4%'
      ${dateFilter}
    ORDER BY t.trandate DESC, t.id, tl.id
  `;

  try {
    console.log('Executing SuiteQL query for project profitability...');
    console.log('Date filter:', options.startDate, 'to', options.endDate);

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean; totalResults: number }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: suiteQL },
        params: { limit: limit.toString(), offset: offset.toString() },
      }
    );

    console.log(`SuiteQL returned ${response.items?.length || 0} rows`);

    // Transform rows to records
    const records: ProjectProfitabilityRecord[] = (response.items || []).map(row => {
      // Parse date - NetSuite returns MM/DD/YYYY format
      const dateParts = (row.trandate || '').split('/');
      let year = 2025;
      let month = 1;
      if (dateParts.length === 3) {
        month = parseInt(dateParts[0]) || 1;
        year = parseInt(dateParts[2]) || 2025;
      }

      const accountNumber = row.account_number || '';
      const isRevenue = accountNumber.startsWith('4');
      // COGS now comes from costestimate field, not 5xxx accounts
      const costestimate = Math.abs(parseFloat(row.costestimate) || 0);

      const className = row.class_name || '';
      const accountName = row.account_name || '';
      const projectType = parseProjectType(accountNumber, accountName);

      return {
        netsuiteTransactionId: row.transaction_id?.toString() || '',
        netsuiteLineId: row.line_id?.toString() || '',
        transactionNumber: row.tranid || '',
        transactionDate: row.trandate || '',
        postingPeriod: row.posting_period || '',
        transactionType: row.transaction_type || '',
        year,
        month,
        customerId: row.customer_id?.toString() || '',
        customerName: row.customer_name || '',
        classId: row.class_id?.toString() || '',
        className,
        projectType,
        accountId: row.account_id?.toString() || '',
        accountNumber,
        accountName: row.account_name || '',
        accountType: row.account_type || '',
        isRevenue,
        isCogs: false, // No longer using 5xxx accounts for COGS
        amount: parseFloat(row.amount) || 0,
        costestimate, // COGS from costestimate field
        quantity: parseFloat(row.quantity) || 0,
        itemId: row.item_id?.toString() || '',
        itemName: row.item_name || '',
      };
    });

    // Log summary for validation
    const totalRevenue = records.filter(r => r.isRevenue).reduce((sum, r) => sum + Math.abs(r.amount), 0);
    const totalCogs = records.reduce((sum, r) => sum + (r.costestimate || 0), 0);
    console.log(`Processed ${records.length} records`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`Total COGS: $${totalCogs.toFixed(2)}`);
    console.log(`Gross Profit: $${(totalRevenue - totalCogs).toFixed(2)}`);

    return {
      records,
      total: response.totalResults || records.length,
      hasMore: response.hasMore || false,
    };
  } catch (error) {
    console.error('Error fetching project profitability:', error);
    throw error;
  }
}

/**
 * Test the NetSuite connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    // Try to fetch a small list of customers to verify connection
    await getCustomers({ limit: 1 });
    return { success: true, message: 'Successfully connected to NetSuite' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Connection failed: ${message}` };
  }
}

/**
 * Test SuiteQL access - query accounts to verify permissions
 */
export async function testSuiteQLAccess(): Promise<{ success: boolean; data: any; error?: string }> {
  try {
    // Test 1: Query Account table for Diversified accounts
    const accountQuery = `
      SELECT id, acctnumber, fullname, accttype
      FROM Account
      WHERE acctnumber LIKE '414%' OR acctnumber LIKE '514%'
      ORDER BY acctnumber
    `;

    console.log('Testing SuiteQL - querying Account table...');
    const accountResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: accountQuery },
        params: { limit: '20' },
      }
    );
    console.log('Account query result:', accountResult.items?.length || 0, 'rows');

    // Test 2: Query Classification table to see all relevant classes
    const classQuery = `
      SELECT id, name, fullname, parent
      FROM Classification
      WHERE fullname LIKE 'Diversified%' OR fullname LIKE 'RCM%' OR fullname LIKE 'AMR%'
      ORDER BY fullname
    `;

    console.log('Testing SuiteQL - querying Classification table...');
    const classResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: classQuery },
        params: { limit: '50' },
      }
    );
    console.log('Classification query result:', classResult.items?.length || 0, 'rows');

    // Test 3: Query TransactionLine for most recent Diversified data
    const talQuery = `
      SELECT
        tl.transaction,
        tl.uniquekey as line_id,
        BUILTIN.DF(tl.class) as class_name,
        tl.class as class_id,
        tl.netamount,
        tl.quantity,
        tl.amount,
        t.trandate,
        t.tranid,
        t.type,
        BUILTIN.DF(t.entity) as customer_name
      FROM TransactionLine tl
      INNER JOIN Transaction t ON t.id = tl.transaction
      WHERE t.posting = 'T'
        AND tl.mainline = 'F'
        AND (tl.class IN (SELECT id FROM Classification WHERE fullname LIKE 'Diversified%'))
      ORDER BY t.trandate DESC
    `;

    console.log('Testing SuiteQL - querying TAL for Dec 2025 Diversified...');
    const talResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: talQuery },
        params: { limit: '20' },
      }
    );
    console.log('TAL query result:', talResult.items?.length || 0, 'rows');

    // Test 4: Check TAL records for 414x accounts (any date)
    const accountsUsedQuery = `
      SELECT
        a.acctnumber,
        a.fullname,
        SUM(COALESCE(tal.credit, 0)) AS total_credit,
        SUM(COALESCE(tal.debit, 0)) AS total_debit,
        COUNT(*) AS line_count,
        MIN(t.trandate) AS earliest_date,
        MAX(t.trandate) AS latest_date
      FROM TransactionAccountingLine tal
      INNER JOIN Transaction t ON t.id = tal.transaction
      INNER JOIN Account a ON a.id = tal.account
      WHERE t.posting = 'T'
        AND a.acctnumber LIKE '414%'
      GROUP BY a.acctnumber, a.fullname
      ORDER BY total_credit DESC
    `;

    console.log('Testing SuiteQL - checking accounts used in Dec 2025 Diversified...');
    const accountsUsedResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: accountsUsedQuery },
        params: { limit: '50' },
      }
    );
    console.log('Accounts used result:', accountsUsedResult.items?.length || 0, 'rows');

    return {
      success: true,
      data: {
        accounts: accountResult.items || [],
        classes: classResult.items || [],
        talSample: talResult.items || [],
        talCount: talResult.items?.length || 0,
        accountsUsedInDec2025: accountsUsedResult.items || [],
      },
    };
  } catch (error) {
    console.error('SuiteQL test error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Work Order by transaction number (WO#)
 * Returns work order header with linked Sales Order reference
 */
export async function getWorkOrderByNumber(woNumber: string): Promise<{
  id: string;
  tranId: string;
  tranDate: string;
  status: string;
  customerId: string;
  customerName: string;
  linkedSalesOrderId?: string;
  linkedSalesOrderNumber?: string;
} | null> {
  if (!woNumber || woNumber.trim() === '') {
    return null;
  }

  // SuiteQL query to find work order by tranId
  // Work orders have type = 'WorkOrd'
  // The createdFrom field links to the originating Sales Order
  const query = `
    SELECT
      t.id,
      t.tranid,
      t.trandate,
      t.status,
      t.entity AS customer_id,
      BUILTIN.DF(t.entity) AS customer_name,
      t.createdfrom AS linked_so_id,
      so.tranid AS linked_so_number
    FROM Transaction t
    LEFT JOIN Transaction so ON so.id = t.createdfrom
    WHERE t.type = 'WorkOrd'
      AND t.tranid = '${woNumber.replace(/'/g, "''")}'
    LIMIT 1
  `;

  try {
    console.log(`Fetching Work Order: ${woNumber}`);

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '1' },
      }
    );

    const row = response.items?.[0];
    if (!row) {
      console.log(`Work Order not found: ${woNumber}`);
      return null;
    }

    return {
      id: row.id,
      tranId: row.tranid,
      tranDate: row.trandate || '',
      status: row.status || '',
      customerId: row.customer_id || '',
      customerName: row.customer_name || '',
      linkedSalesOrderId: row.linked_so_id || undefined,
      linkedSalesOrderNumber: row.linked_so_number || undefined,
    };
  } catch (error) {
    console.error(`Error fetching Work Order ${woNumber}:`, error);
    throw error;
  }
}

/**
 * Fetch Sales Order with line item details
 * Returns SO header and all line items with quantities, prices, and cost estimates
 */
export async function getSalesOrderWithLineItems(soId: string): Promise<{
  id: string;
  tranId: string;
  tranDate: string;
  status: string;
  customerId: string;
  customerName: string;
  lineItems: Array<{
    lineId: string;
    itemId: string;
    itemName: string;
    itemDescription: string;
    itemType: string;
    quantity: number;
    unitPrice: number;
    lineAmount: number;
    costEstimate: number;
  }>;
} | null> {
  if (!soId || soId.trim() === '') {
    return null;
  }

  // SuiteQL query to get SO header + line items
  // Sales orders have type = 'SalesOrd'
  // Line items have mainline = 'F' (detail lines, not header line)
  // Join Item table to get item details
  const query = `
    SELECT
      t.id AS transaction_id,
      t.tranid AS transaction_number,
      t.trandate AS transaction_date,
      t.status,
      t.entity AS customer_id,
      BUILTIN.DF(t.entity) AS customer_name,
      tl.id AS line_id,
      tl.item AS item_id,
      BUILTIN.DF(tl.item) AS item_name,
      i.displayname AS item_description,
      i.itemtype AS item_type,
      tl.quantity,
      tl.rate AS unit_price,
      tl.amount AS line_amount,
      tl.costestimate
    FROM Transaction t
    INNER JOIN TransactionLine tl ON tl.transaction = t.id
    LEFT JOIN Item i ON i.id = tl.item
    WHERE t.id = '${soId.replace(/'/g, "''")}'
      AND t.type = 'SalesOrd'
      AND tl.mainline = 'F'
      AND tl.item IS NOT NULL
    ORDER BY tl.id
  `;

  try {
    console.log(`Fetching Sales Order: ${soId}`);

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '1000' },
      }
    );

    const rows = response.items || [];
    if (rows.length === 0) {
      console.log(`Sales Order not found or has no line items: ${soId}`);
      return null;
    }

    // First row has the header info
    const firstRow = rows[0];

    // Transform all rows to line items
    const lineItems = rows.map(row => ({
      lineId: row.line_id || '',
      itemId: row.item_id || '',
      itemName: row.item_name || '',
      itemDescription: row.item_description || '',
      itemType: row.item_type || '',
      quantity: parseFloat(row.quantity) || 0,
      unitPrice: parseFloat(row.unit_price) || 0,
      lineAmount: parseFloat(row.line_amount) || 0,
      costEstimate: parseFloat(row.costestimate) || 0,
    }));

    return {
      id: firstRow.transaction_id,
      tranId: firstRow.transaction_number,
      tranDate: firstRow.transaction_date || '',
      status: firstRow.status || '',
      customerId: firstRow.customer_id || '',
      customerName: firstRow.customer_name || '',
      lineItems,
    };
  } catch (error) {
    console.error(`Error fetching Sales Order ${soId}:`, error);
    throw error;
  }
}
