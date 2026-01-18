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
      AND t.type = 'CustInvc'
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
 * Parse project type from item class and account number
 *
 * Primary: Uses item class name from NetSuite Item table
 * Fallback: Uses account number if item class is unavailable
 *
 * Maps NetSuite data to project types matching the Excel spreadsheet:
 * - TBEN: Test Bench Equipment New (4011, 5011)
 * - TBEU: Test Bench Equipment Upgrade (4012, 5012)
 * - PM: Project Management Fee (4013, 5013)
 * - SCH: Shipping & Handling (4018, 4050, 5018, 5050)
 * - TBIN: TB Install & Training New (4031, 5031)
 * - TBIU: TB Install & Training Upgrade (4032, 5032)
 * - M3IN: M3 Install New (4041, 5041)
 * - M3IU: M3 Install Upgrade (4042, 5042)
 * - M3NEW: M3 Software New (4051, 5051)
 * - M3SW: M3 Software (4052+, 4080-4099, 5052+, 5080-5099)
 * - MCC: MCC Services (4100-4111, 5100-5111)
 * - TBSV: TB Service/Maintenance (4071-4079, 5071-5079)
 */
export function parseProjectType(
  accountNumber: string,
  accountName?: string,
  itemClassName?: string
): string {
  // Primary: Use item class name if available
  if (itemClassName) {
    const className = itemClassName.toLowerCase();

    // Direct mappings from Item class
    if (className.includes('test bench') || className.includes('testbench')) {
      // Use account number to determine if it's Equipment, Install, Service, PM, SCH, or MCC
      if (accountNumber) {
        const acct = accountNumber.trim();
        // Check if account is MCC Services (4101-4111, excluding 4140-4149)
        if ((acct.startsWith('410') || acct.startsWith('411')) && !acct.startsWith('414')) return 'MCC';
        if ((acct.startsWith('510') || acct.startsWith('511')) && !acct.startsWith('514')) return 'MCC';
        // Project Management and Shipping
        if (acct === '4013' || acct === '5013') return 'PM';
        if (acct === '4018' || acct === '5018') return 'SCH';
        // Test Bench specific accounts
        if (acct.startsWith('401') || acct.startsWith('501')) return 'TBEN';
        if (acct.startsWith('403') || acct.startsWith('503')) return 'TBIN';
        if (acct.startsWith('407') || acct.startsWith('507')) return 'TB Service';
      }
      // Default to TBEN if account doesn't specify
      return 'TBEN';
    }

    if (className.includes('mcc') || className.includes('maintenance') || className.includes('calibration')) {
      return 'MCC';
    }

    if (className.includes('m3') || className.includes('laser')) {
      // Use account to determine Install vs Software (New vs Other)
      if (accountNumber) {
        const acct = accountNumber.trim();
        if (acct.startsWith('404') || acct.startsWith('504')) return 'M3IN';
        if (acct === '4051' || acct === '5051') return 'M3NEW'; // M3 Software New
        if (acct.startsWith('405') || acct.startsWith('408') || acct.startsWith('409') ||
            acct.startsWith('505') || acct.startsWith('508') || acct.startsWith('509')) return 'M3 Software';
      }
      return 'M3 Software';
    }

    // Other, Diversified, etc. → Other
    if (className.includes('other') || className.includes('diversified') || className.includes('veroflow')) {
      return 'Other';
    }
  }

  // Fallback: Use account number classification
  if (!accountNumber) return 'Unknown';

  const acct = accountNumber.trim();

  // Test Bench Equipment
  if (acct === '4011' || acct === '5011') return 'TBEN';
  if (acct === '4012' || acct === '5012') return 'TBEU';
  if (acct === '4013' || acct === '5013') return 'PM'; // Project Management Fee
  if (acct === '4018' || acct === '5018') return 'SCH'; // TB Freight/Shipping
  if (acct.startsWith('401') || acct.startsWith('501')) return 'TBEN'; // 4010, 4014-4017, 4019, etc.
  if (acct === '4021' || acct === '5021') return 'TB Components';

  // TB Install & Training
  if (acct === '4031' || acct === '5031') return 'TBIN';
  if (acct === '4032' || acct === '5032') return 'TBIU';
  if (acct.startsWith('403') || acct.startsWith('503')) return 'TBIN';

  // M3 Install & Training
  if (acct === '4041' || acct === '5041') return 'M3IN';
  if (acct === '4042' || acct === '5042') return 'M3IU';
  if (acct.startsWith('404') || acct.startsWith('504')) return 'M3IN';

  // Shipping and Handling (exclude from M3 Software)
  if (acct === '4050' || acct === '5050') return 'SCH';

  // M3 Software - separate New from other software
  if (acct === '4051' || acct === '5051') return 'M3NEW'; // M3 Software New
  if (acct.startsWith('405') && acct !== '4050' && acct !== '4051' ||
      acct.startsWith('505') && acct !== '5050' && acct !== '5051') return 'M3 Software';
  if (acct.startsWith('408') || acct.startsWith('409') ||
      acct.startsWith('508') || acct.startsWith('509')) return 'M3 Software';

  // TB Service/Maintenance
  if (acct.startsWith('407') || acct.startsWith('507')) return 'TB Service';

  // MCC Services (4100-4111, 5100-5111, but exclude 414x for Diversified Products)
  if ((acct.startsWith('410') || acct.startsWith('411')) && !acct.startsWith('414')) return 'MCC';
  if ((acct.startsWith('510') || acct.startsWith('511')) && !acct.startsWith('514')) return 'MCC';

  // Diversified Products
  if (acct.startsWith('414') || acct.startsWith('514')) return 'Other';

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
      i.itemid AS item_name,
      i.displayname AS item_description
    FROM Transaction t
    INNER JOIN TransactionLine tl ON tl.transaction = t.id
    LEFT JOIN Account a ON a.id = tl.account
    LEFT JOIN Item i ON i.id = tl.item
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
 *
 * Automatically tries multiple WO number formats to handle different NetSuite configurations:
 * - As-is (e.g., "4158")
 * - With "WO" prefix (e.g., "WO4158")
 * - With "WO-" prefix (e.g., "WO-4158")
 * - Padded with zeros (e.g., "004158")
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

  // Generate all possible WO number formats to try
  const cleanNumber = woNumber.trim();
  const formatsToTry = [
    cleanNumber,                                    // As-is: "4158"
    `WO${cleanNumber}`,                            // With prefix: "WO4158"
    `WO-${cleanNumber}`,                           // With dash: "WO-4158"
    `WO ${cleanNumber}`,                           // With space: "WO 4158"
    cleanNumber.padStart(6, '0'),                  // Padded: "004158"
    `WO${cleanNumber.padStart(6, '0')}`,          // Prefix + padded: "WO004158"
  ];

  // Remove duplicates
  const uniqueFormats = [...new Set(formatsToTry)];

  console.log(`Fetching Work Order: ${woNumber} (trying ${uniqueFormats.length} formats)`);

  // Try each format until we find a match
  for (const format of uniqueFormats) {
    try {
      // SuiteQL query to find work order by tranId
      // Work orders have type = 'WorkOrd'
      // The createdFrom field is in TransactionLine (mainline), not Transaction
      const query = `
        SELECT
          wo.id,
          wo.tranid,
          wo.trandate,
          wo.status,
          wo.entity AS customer_id,
          BUILTIN.DF(wo.entity) AS customer_name,
          woline.createdfrom AS linked_so_id,
          so.tranid AS linked_so_number
        FROM Transaction wo
        INNER JOIN TransactionLine woline ON woline.transaction = wo.id AND woline.mainline = 'T'
        LEFT JOIN Transaction so ON so.id = woline.createdfrom
        WHERE wo.type = 'WorkOrd'
          AND wo.tranid = '${format.replace(/'/g, "''")}'
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: '1' },
        }
      );

      const row = response.items?.[0];
      if (row) {
        console.log(`✓ Work Order found using format: "${format}" (original: "${woNumber}")`);
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
      }
    } catch (error) {
      // If this format fails, try the next one
      console.log(`  ✗ Format "${format}" failed, trying next...`);
      continue;
    }
  }

  // None of the formats worked as WorkOrd - try to find it as ANY transaction type for diagnostic purposes
  console.log(`⚠ Work Order not found with type='WorkOrd', searching for any transaction type...`);

  for (const format of uniqueFormats) {
    try {
      const diagnosticQuery = `
        SELECT id, tranid, type, status
        FROM Transaction
        WHERE tranid = '${format.replace(/'/g, "''")}'
      `;

      const response = await netsuiteRequest<{ items: any[] }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: diagnosticQuery },
          params: { limit: '1' },
        }
      );

      const row = response.items?.[0];
      if (row) {
        console.log(`⚠ DIAGNOSTIC: Found transaction "${format}" but type is "${row.type}", not "WorkOrd"`);
        console.log(`   Full record: ${JSON.stringify(row)}`);
        // Don't return it since it's not a Work Order
        break;
      }
    } catch (error) {
      continue;
    }
  }

  console.log(`✗ Work Order not found: ${woNumber} (tried formats: ${uniqueFormats.join(', ')})`);
  return null;
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

/**
 * BULK SYNC FUNCTIONS
 * These functions fetch ALL work orders and sales orders from NetSuite
 * for populating standalone cache tables
 */

export interface WorkOrderRecord {
  netsuite_id: string;
  wo_number: string;
  wo_date: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_id: string | null;
  created_from_so_id: string | null;
  created_from_so_number: string | null;
  bill_of_materials_id: string | null;
  bill_of_materials_revision_id: string | null;
  manufacturing_routing_id: string | null;
  item_id: string | null;
  assembly_description: string | null;
  serial_number: string | null;
}

export interface WorkOrderLineRecord {
  netsuite_line_id: string;
  line_number: number;
  item_id: string | null;
  item_name: string | null;
  item_description: string | null;
  item_type: string | null;
  quantity: number | null;
  quantity_completed: number | null;
  unit_cost: number | null;
  line_cost: number | null;        // Will now use actual cost from WOCompl/WOIssue
  cost_estimate: number | null;    // Estimated cost from WO line
  actual_cost: number | null;      // Actual cost from WOCompl/WOIssue transactions
  est_gross_profit: number | null;
  est_gross_profit_pct: number | null;
  class_id: string | null;
  class_name: string | null;
  location_id: string | null;
  location_name: string | null;
  expected_completion_date: string | null;
  is_closed: boolean;
}

/**
 * Fetch ALL work orders from NetSuite within date range
 * Used to populate standalone netsuite_work_orders table
 */
export async function getAllWorkOrders(options?: {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status?: string[];
  limit?: number;
}): Promise<WorkOrderRecord[]> {
  const { limit = 5000 } = options || {};
  const PAGE_SIZE = 1000; // NetSuite max per request

  // Build date filter - NetSuite uses MM/DD/YYYY format
  let dateFilter = '';
  if (options?.startDate) {
    const [y, m, d] = options.startDate.split('-');
    dateFilter += ` AND wo.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }
  if (options?.endDate) {
    const [y, m, d] = options.endDate.split('-');
    dateFilter += ` AND wo.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  // Build status filter
  let statusFilter = '';
  if (options?.status && options.status.length > 0) {
    const statuses = options.status.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
    statusFilter = ` AND wo.status IN (${statuses})`;
  }

  const query = `
    SELECT
      wo.id,
      wo.tranid,
      wo.trandate,
      wo.status,
      wo.startdate,
      wo.enddate,
      wo.entity AS customer_id,
      wo.billofmaterials,
      wo.billofmaterialsrevision,
      wo.manufacturingrouting,
      woline.createdfrom AS created_from_so_id,
      so.tranid AS created_from_so_number,
      wo.custbodyitemid,
      wo.custbodyiqsassydescription AS assembly_description,
      wo.custbodycustserialmst AS serial_number
    FROM transaction wo
    INNER JOIN transactionline woline ON woline.transaction = wo.id AND woline.mainline = 'T'
    LEFT JOIN transaction so ON so.id = woline.createdfrom
    WHERE wo.type = 'WorkOrd'
      ${dateFilter}
      ${statusFilter}
    ORDER BY wo.trandate DESC
  `;

  try {
    console.log(`Fetching all work orders (limit: ${limit})...`);
    console.log(`Date range: ${options?.startDate || 'all'} to ${options?.endDate || 'all'}`);

    // Paginate through all results
    let allItems: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allItems.length < limit) {
      const pageLimit = Math.min(PAGE_SIZE, limit - allItems.length);
      console.log(`  Fetching work orders at offset ${offset} (limit: ${pageLimit})...`);

      const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: query },
          params: { limit: pageLimit.toString(), offset: offset.toString() },
        }
      );

      const items = response.items || [];
      allItems = allItems.concat(items);
      hasMore = response.hasMore && items.length === pageLimit;
      offset += items.length;

      console.log(`  Fetched ${items.length} work orders (total: ${allItems.length})`);
    }

    const workOrders: WorkOrderRecord[] = allItems.map(row => ({
      netsuite_id: row.id || '',
      wo_number: row.tranid || '',
      wo_date: row.trandate || null,
      status: row.status || null,
      start_date: row.startdate || null,
      end_date: row.enddate || null,
      customer_id: row.customer_id || null,
      created_from_so_id: row.created_from_so_id || null,
      created_from_so_number: row.created_from_so_number || null,
      bill_of_materials_id: row.billofmaterials || null,
      bill_of_materials_revision_id: row.billofmaterialsrevision || null,
      manufacturing_routing_id: row.manufacturingrouting || null,
      item_id: row.custbodyitemid || null,
      assembly_description: row.assembly_description || null,
      serial_number: row.serial_number || null,
    }));

    console.log(`Fetched ${workOrders.length} work orders from NetSuite`);
    return workOrders;
  } catch (error) {
    console.error('Error fetching all work orders:', error);
    throw error;
  }
}

/**
 * Fetch line items for a specific work order
 * Used to populate netsuite_work_order_lines table
 *
 * NOTE: This function does NOT fetch actual costs (too slow for per-WO queries).
 * Use the batch sync endpoint /api/netsuite/sync-actual-costs to populate actual costs.
 */
export async function getWorkOrderLines(woId: string): Promise<WorkOrderLineRecord[]> {
  if (!woId || woId.trim() === '') {
    return [];
  }

  // Get basic line items from the Work Order
  const lineQuery = `
    SELECT
      tl.id AS line_id,
      tl.linesequencenumber AS line_number,
      tl.item AS item_id,
      i.itemid AS item_name,
      i.displayname AS item_display_name,
      i.description AS item_description,
      tl.itemtype AS item_type,
      tl.quantity,
      tl.quantityshiprecv AS quantity_completed,
      tl.rate,
      tl.costestimate,
      tl.estgrossprofit,
      tl.estgrossprofitpercent,
      COALESCE(i.averagecost, i.lastpurchaseprice, 0) AS item_avg_cost,
      tl.location AS location_id,
      tl.class AS class_id,
      tl.isclosed
    FROM transactionline tl
    LEFT JOIN item i ON i.id = tl.item
    WHERE tl.transaction = '${woId.replace(/'/g, "''")}'
      AND tl.mainline = 'F'
      AND tl.item IS NOT NULL
    ORDER BY tl.linesequencenumber
  `;

  try {
    console.log(`Fetching line items for WO ${woId}...`);

    const lineResponse = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: lineQuery }, params: { limit: '1000' } }
    );

    const lines: WorkOrderLineRecord[] = (lineResponse.items || []).map(row => {
      const qty = row.quantity !== null && row.quantity !== undefined ? parseFloat(row.quantity) : 0;
      const qtyCompleted = row.quantity_completed !== null && row.quantity_completed !== undefined ? parseFloat(row.quantity_completed) : null;

      // Use rate from transactionLine if available, otherwise fall back to item average cost
      const rate = row.rate !== null && row.rate !== undefined ? parseFloat(row.rate) : null;
      const itemAvgCost = row.item_avg_cost !== null && row.item_avg_cost !== undefined ? parseFloat(row.item_avg_cost) : 0;
      const unitCost = rate !== null ? rate : itemAvgCost;

      // Cost estimate from WO line
      const costEstimate = row.costestimate !== null && row.costestimate !== undefined ? parseFloat(row.costestimate) : null;

      // line_cost: use estimate if available, fall back to calculated
      // Actual cost will be populated by the batch sync endpoint
      const lineCost = costEstimate !== null && costEstimate > 0 ? costEstimate : unitCost * Math.abs(qty);

      // Gross profit fields
      const estGrossProfit = row.estgrossprofit !== null && row.estgrossprofit !== undefined ? parseFloat(row.estgrossprofit) : null;
      const estGrossProfitPct = row.estgrossprofitpercent !== null && row.estgrossprofitpercent !== undefined ? parseFloat(row.estgrossprofitpercent) : null;

      return {
        netsuite_line_id: row.line_id || '',
        line_number: parseInt(row.line_number) || 0,
        item_id: row.item_id || null,
        item_name: row.item_name || row.item_display_name || null,
        item_description: row.item_description || null,
        item_type: row.item_type || null,
        quantity: qty,
        quantity_completed: qtyCompleted,
        unit_cost: unitCost,
        line_cost: lineCost,          // Estimated cost (actual cost comes from batch sync)
        cost_estimate: costEstimate,  // Original estimate from WO
        actual_cost: null,            // Will be populated by /api/netsuite/sync-actual-costs
        est_gross_profit: estGrossProfit,
        est_gross_profit_pct: estGrossProfitPct,
        class_id: row.class_id || null,
        class_name: null,
        location_id: row.location_id || null,
        location_name: null,
        expected_completion_date: null,
        is_closed: row.isclosed === 'T',
      };
    });

    console.log(`Fetched ${lines.length} line items for WO ${woId}`);
    return lines;
  } catch (error) {
    console.error(`Error fetching line items for WO ${woId}:`, error);
    throw error;
  }
}

export interface SalesOrderRecord {
  netsuite_id: string;
  so_number: string;
  so_date: string | null;
  posting_period: string | null;
  status: string | null;
  memo: string | null;
  customer_id: string | null;
  customer_name: string | null;
  subtotal: number | null;
  discount_total: number | null;
  tax_total: number | null;
  total_amount: number | null;
  terms: string | null;
  ship_method: string | null;
  ship_date: string | null;
  expected_ship_date: string | null;
  subsidiary_id: string | null;
  subsidiary_name: string | null;
  location_id: string | null;
  location_name: string | null;
  class_id: string | null;
  class_name: string | null;
  department_id: string | null;
  department_name: string | null;
  sales_rep_id: string | null;
  sales_rep_name: string | null;
}

export interface SalesOrderLineRecord {
  netsuite_line_id: string;
  line_number: number;
  item_id: string | null;
  item_name: string | null;
  item_description: string | null;
  item_type: string | null;
  quantity: number | null;
  quantity_committed: number | null;
  quantity_fulfilled: number | null;
  quantity_billed: number | null;
  rate: number | null;
  amount: number | null;
  cost_estimate: number | null;
  cost_estimate_type: string | null;
  class_id: string | null;
  class_name: string | null;
  department_id: string | null;
  department_name: string | null;
  location_id: string | null;
  location_name: string | null;
  expected_ship_date: string | null;
  is_closed: boolean;
  closed_date: string | null;
}

/**
 * Fetch ALL sales orders from NetSuite within date range
 * Used to populate standalone netsuite_sales_orders table
 */
/**
 * Batch fetch actual costs from Work Order Completion/Issue transactions
 * This is more efficient than fetching per-WO because it runs ONE query for all WOs
 *
 * @param options - startDate, endDate in YYYY-MM-DD format, limit
 * @returns Map of WO NetSuite ID -> { total: number, byItem: Map<itemId, cost> }
 */
export async function getActualCosts(options?: {
  startDate?: string;
  endDate?: string;
  woIds?: string[];
  limit?: number;
}): Promise<Map<string, { woNumber: string; total: number; byItem: Map<string, number> }>> {
  const { limit = 10000 } = options || {};

  // Build date filter (on completion transaction date)
  let dateFilter = '';
  if (options?.startDate) {
    const [y, m, d] = options.startDate.split('-');
    dateFilter += ` AND t.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }
  if (options?.endDate) {
    const [y, m, d] = options.endDate.split('-');
    dateFilter += ` AND t.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  // Build WO filter if specific IDs provided
  let woFilter = '';
  if (options?.woIds && options.woIds.length > 0) {
    const woIdList = options.woIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    woFilter = ` AND completionLine.createdfrom IN (${woIdList})`;
  }

  // Efficient query for actual costs from WOCompl/WOIssue transactions
  const query = `
    SELECT
      completionLine.createdfrom AS wo_id,
      completionLine.item AS item_id,
      SUM(ABS(COALESCE(tal.amount, 0))) AS actual_cost
    FROM TransactionLine completionLine
    INNER JOIN Transaction t ON t.id = completionLine.transaction
    INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id
      AND tal.transactionline = completionLine.id
    WHERE t.type IN ('WOCompl', 'WOIssue')
      AND tal.posting = 'T'
      AND tal.amount < 0
      AND completionLine.createdfrom IS NOT NULL
      ${dateFilter}
      ${woFilter}
    GROUP BY completionLine.createdfrom, completionLine.item
  `;

  try {
    console.log(`Fetching actual costs (limit: ${limit})...`);

    const response = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: limit.toString() },
      }
    );

    const rows = response.items || [];
    console.log(`Fetched ${rows.length} actual cost records from NetSuite`);

    // Build result map (wo_id -> cost data)
    // Note: woNumber is not available from query - caller can look it up if needed
    const result = new Map<string, { woNumber: string; total: number; byItem: Map<string, number> }>();

    for (const row of rows) {
      const woId = row.wo_id?.toString() || '';
      const itemId = row.item_id?.toString() || '';
      const actualCost = parseFloat(row.actual_cost) || 0;

      if (!result.has(woId)) {
        result.set(woId, {
          woNumber: '', // Not available from query - use woId as fallback
          total: 0,
          byItem: new Map(),
        });
      }

      const woData = result.get(woId)!;
      woData.byItem.set(itemId, (woData.byItem.get(itemId) || 0) + actualCost);
      woData.total += actualCost;
    }

    console.log(`Actual costs found for ${result.size} work orders`);
    return result;
  } catch (error) {
    console.error('Error fetching actual costs:', error);
    throw error;
  }
}

export async function getAllSalesOrders(options?: {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status?: string[];
  includeLineItems?: boolean;
  limit?: number;
}): Promise<{ headers: SalesOrderRecord[]; linesBySOId: Record<string, SalesOrderLineRecord[]> }> {
  const { limit = 5000, includeLineItems = true } = options || {};
  const PAGE_SIZE = 1000; // NetSuite max per request

  // Build date filter
  let dateFilter = '';
  if (options?.startDate) {
    const [y, m, d] = options.startDate.split('-');
    dateFilter += ` AND so.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }
  if (options?.endDate) {
    const [y, m, d] = options.endDate.split('-');
    dateFilter += ` AND so.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  // Build status filter
  let statusFilter = '';
  if (options?.status && options.status.length > 0) {
    const statuses = options.status.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
    statusFilter = ` AND so.status IN (${statuses})`;
  }

  const headerQuery = `
    SELECT
      so.id,
      so.tranid,
      so.trandate,
      BUILTIN.DF(so.postingperiod) AS posting_period,
      so.status,
      so.memo,
      so.entity AS customer_id,
      BUILTIN.DF(so.entity) AS customer_name,
      so.taxtotal,
      so.total,
      BUILTIN.DF(so.terms) AS terms,
      BUILTIN.DF(so.shipmethod) AS ship_method,
      so.shipdate,
      so.subsidiary AS subsidiary_id,
      BUILTIN.DF(so.subsidiary) AS subsidiary_name,
      so.location AS location_id,
      BUILTIN.DF(so.location) AS location_name
    FROM transaction so
    WHERE so.type = 'SalesOrd'
      ${dateFilter}
      ${statusFilter}
    ORDER BY so.trandate DESC
  `;

  try {
    console.log(`Fetching all sales orders (limit: ${limit})...`);
    console.log(`Date range: ${options?.startDate || 'all'} to ${options?.endDate || 'all'}`);
    console.log(`Include line items: ${includeLineItems}`);

    // Paginate through all results
    let allItems: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allItems.length < limit) {
      const pageLimit = Math.min(PAGE_SIZE, limit - allItems.length);
      console.log(`  Fetching page at offset ${offset} (limit: ${pageLimit})...`);

      const response = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
        '/services/rest/query/v1/suiteql',
        {
          method: 'POST',
          body: { q: headerQuery },
          params: { limit: pageLimit.toString(), offset: offset.toString() },
        }
      );

      const items = response.items || [];
      allItems = allItems.concat(items);
      hasMore = response.hasMore && items.length === pageLimit;
      offset += items.length;

      console.log(`  Fetched ${items.length} records (total: ${allItems.length})`);
    }

    const headers: SalesOrderRecord[] = allItems.map(row => ({
      netsuite_id: row.id || '',
      so_number: row.tranid || '',
      so_date: row.trandate || null,
      posting_period: row.posting_period || null,
      status: row.status || null,
      memo: row.memo || null,
      customer_id: row.customer_id || null,
      customer_name: row.customer_name || null,
      subtotal: null, // Field not available in SuiteQL for SalesOrd
      discount_total: null, // Field not available in SuiteQL for SalesOrd
      tax_total: parseFloat(row.taxtotal) || null,
      total_amount: parseFloat(row.total) || null,
      terms: row.terms || null,
      ship_method: row.ship_method || null,
      ship_date: row.shipdate || null,
      expected_ship_date: null, // Field not available in SuiteQL for SalesOrd
      subsidiary_id: row.subsidiary_id || null,
      subsidiary_name: row.subsidiary_name || null,
      location_id: row.location_id || null,
      location_name: row.location_name || null,
      class_id: null, // Field not available in SuiteQL for SalesOrd
      class_name: null, // Field not available in SuiteQL for SalesOrd
      department_id: null, // Field not available in SuiteQL for SalesOrd
      department_name: null, // Field not available in SuiteQL for SalesOrd
      sales_rep_id: null, // Field not available in SuiteQL for SalesOrd
      sales_rep_name: null, // Field not available in SuiteQL for SalesOrd
    }));

    console.log(`Fetched ${headers.length} sales orders from NetSuite`);

    // Fetch line items if requested
    const linesBySOId: Record<string, SalesOrderLineRecord[]> = {};

    if (includeLineItems && headers.length > 0) {
      console.log('Fetching line items for all sales orders...');

      // Build IN clause with all SO IDs
      const soIds = headers.map(h => `'${h.netsuite_id.replace(/'/g, "''")}'`).join(',');

      const lineQuery = `
        SELECT
          tl.transaction AS so_id,
          tl.id AS line_id,
          tl.linesequencenumber AS line_number,
          tl.item AS item_id,
          COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
          COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description,
          tl.itemtype AS item_type,
          tl.quantity,
          tl.rate,
          tl.amount,
          tl.costestimate,
          tl.location AS location_id,
          tl.isclosed
        FROM transactionline tl
        LEFT JOIN Item i ON i.id = tl.item
        WHERE tl.transaction IN (${soIds})
          AND tl.mainline = 'F'
          AND tl.item IS NOT NULL
        ORDER BY tl.transaction, tl.linesequencenumber
      `;

      // Paginate through all line items
      let allLineItems: any[] = [];
      let lineOffset = 0;
      let hasMoreLines = true;

      while (hasMoreLines) {
        console.log(`  Fetching line items at offset ${lineOffset}...`);

        const lineResponse = await netsuiteRequest<{ items: any[]; hasMore: boolean }>(
          '/services/rest/query/v1/suiteql',
          {
            method: 'POST',
            body: { q: lineQuery },
            params: { limit: PAGE_SIZE.toString(), offset: lineOffset.toString() },
          }
        );

        const items = lineResponse.items || [];
        allLineItems = allLineItems.concat(items);
        hasMoreLines = lineResponse.hasMore && items.length === PAGE_SIZE;
        lineOffset += items.length;

        console.log(`  Fetched ${items.length} line items (total: ${allLineItems.length})`);
      }

      // Group lines by SO ID
      for (const row of allLineItems) {
        const soId = row.so_id || '';
        if (!linesBySOId[soId]) {
          linesBySOId[soId] = [];
        }

        linesBySOId[soId].push({
          netsuite_line_id: row.line_id || '',
          line_number: parseInt(row.line_number) || 0,
          item_id: row.item_id || null,
          item_name: row.item_name || null,
          item_description: row.item_description || null,
          item_type: row.item_type || null,
          quantity: parseFloat(row.quantity) || null,
          quantity_committed: null, // Field not available in SuiteQL
          quantity_fulfilled: null, // Field not available in SuiteQL
          quantity_billed: null, // Field not available in SuiteQL
          rate: parseFloat(row.rate) || null,
          amount: parseFloat(row.amount) || null,
          cost_estimate: parseFloat(row.costestimate) || null,
          cost_estimate_type: null, // Field not available in SuiteQL
          class_id: null, // Field not available in SuiteQL
          class_name: null, // Field not available in SuiteQL
          department_id: null, // Field not available in SuiteQL
          department_name: null, // Field not available in SuiteQL
          location_id: row.location_id || null,
          location_name: null, // Not queried to avoid BUILTIN overhead
          expected_ship_date: null, // Field not available in SuiteQL
          is_closed: row.isclosed === 'T',
          closed_date: null, // Field not available in SuiteQL
        });
      }

      const totalLines = Object.values(linesBySOId).reduce((sum, lines) => sum + lines.length, 0);
      console.log(`Fetched ${totalLines} line items across ${headers.length} sales orders`);
    }

    return { headers, linesBySOId };
  } catch (error) {
    console.error('Error fetching all sales orders:', error);
    throw error;
  }
}
