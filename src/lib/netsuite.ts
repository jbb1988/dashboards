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
 * Queries transaction lines with Diversified Products class
 */
export async function getDiversifiedSales(options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ records: DiversifiedSaleRecord[]; total: number; hasMore: boolean }> {
  const { limit = 100, offset = 0 } = options;

  // Build SuiteQL query for transaction lines with Diversified class
  let dateFilter = '';
  if (options.startDate) {
    dateFilter += ` AND t.trandate >= TO_DATE('${options.startDate}', 'YYYY-MM-DD')`;
  }
  if (options.endDate) {
    dateFilter += ` AND t.trandate <= TO_DATE('${options.endDate}', 'YYYY-MM-DD')`;
  }

  // Query transaction lines joined with class info
  const suiteQL = `
    SELECT
      t.id AS transaction_id,
      t.tranid,
      t.trandate,
      t.postingperiod,
      c.entityid AS customer_name,
      c.id AS customer_id,
      cl.name AS class_name,
      tl.amount,
      tl.quantity,
      i.itemid AS item_name
    FROM transactionline tl
    INNER JOIN transaction t ON t.id = tl.transaction
    LEFT JOIN customer c ON c.id = t.entity
    LEFT JOIN classification cl ON cl.id = tl.class
    LEFT JOIN item i ON i.id = tl.item
    WHERE t.type = 'CustInvc'
      AND cl.name LIKE '%Diversified%'
      ${dateFilter}
    ORDER BY t.trandate DESC
  `;

  try {
    console.log('Executing SuiteQL query for diversified sales...');

    const response = await netsuiteRequest<{ items: any[]; hasMore: boolean; totalResults: number }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: suiteQL },
        params: { limit: limit.toString(), offset: offset.toString() },
      }
    );

    console.log(`SuiteQL returned ${response.items?.length || 0} rows`);

    const records: DiversifiedSaleRecord[] = [];

    for (const row of response.items || []) {
      const tranDate = new Date(row.trandate);
      const year = tranDate.getFullYear();
      const month = tranDate.getMonth() + 1;

      const className = row.class_name || 'Diversified Products';
      const { category, parent } = parseClassName(className);

      const revenue = parseFloat(row.amount) || 0;

      records.push({
        netsuiteTransactionId: row.transaction_id?.toString() || '',
        netsuiteLineId: '0',
        transactionType: 'Invoice',
        transactionNumber: row.tranid || '',
        transactionDate: row.trandate || '',
        postingPeriod: row.postingperiod || '',
        year,
        month,
        classId: '',
        className,
        classCategory: category,
        parentClass: parent,
        customerId: row.customer_id?.toString() || '',
        customerName: row.customer_name || '',
        accountId: '',
        accountName: '',
        quantity: parseInt(row.quantity) || 1,
        revenue,
        cost: 0,
        grossProfit: revenue,
        grossProfitPct: 100,
        itemId: '',
        itemName: row.item_name || '',
        itemDescription: '',
      });
    }

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
