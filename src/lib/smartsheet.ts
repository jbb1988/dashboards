/**
 * Smartsheet API Client
 * Fetches sheets, rows, and columns from Smartsheet
 */

const SMARTSHEET_BASE_URL = 'https://api.smartsheet.com/2.0';

// Type definitions
export interface SmartsheetSheet {
  id: number;
  name: string;
  accessLevel: string;
  permalink: string;
  createdAt: string;
  modifiedAt: string;
  totalRowCount?: number;
  columns?: SmartsheetColumn[];
  rows?: SmartsheetRow[];
}

export interface SmartsheetColumn {
  id: number;
  index: number;
  title: string;
  type: string;
  primary?: boolean;
  width?: number;
  options?: string[];
  symbol?: string;
  systemColumnType?: string;
  autoNumberFormat?: {
    prefix?: string;
    suffix?: string;
    fill?: string;
    startingNumber?: number;
  };
}

export interface SmartsheetCell {
  columnId: number;
  value?: string | number | boolean | null;
  displayValue?: string;
  formula?: string;
  hyperlink?: {
    url?: string;
    sheetId?: number;
    reportId?: number;
  };
  linkInFromCell?: {
    sheetId: number;
    rowId: number;
    columnId: number;
  };
}

export interface SmartsheetRow {
  id: number;
  rowNumber: number;
  expanded?: boolean;
  createdAt?: string;
  modifiedAt?: string;
  cells: SmartsheetCell[];
  parentId?: number;
  siblingId?: number;
  toTop?: boolean;
  toBottom?: boolean;
  indent?: number;
  outdent?: number;
  locked?: boolean;
  lockedForUser?: boolean;
}

export interface SmartsheetWorkspace {
  id: number;
  name: string;
  accessLevel: string;
  permalink: string;
}

export interface SmartsheetFolder {
  id: number;
  name: string;
  permalink: string;
  sheets?: SmartsheetSheet[];
  folders?: SmartsheetFolder[];
}

export interface SmartsheetUser {
  id: number;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  admin?: boolean;
  licensedSheetCreator?: boolean;
  status?: string;
}

// API Response types
interface SmartsheetResponse<T> {
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  totalCount?: number;
  data?: T[];
}

interface SmartsheetListResponse<T> {
  pageNumber?: number;
  pageSize?: number;
  totalPages?: number;
  totalCount?: number;
  data: T[];
}

// Helper to get auth headers
function getHeaders(): HeadersInit {
  const token = process.env.SMARTSHEET_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SMARTSHEET_ACCESS_TOKEN not configured');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// Generic fetch helper
async function smartsheetFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${SMARTSHEET_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Smartsheet API error (${response.status}): ${error}`);
  }

  return response.json();
}

// Fetch with pagination support
async function smartsheetFetchAll<T>(
  endpoint: string
): Promise<T[]> {
  let allData: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await smartsheetFetch<SmartsheetListResponse<T>>(
      `${endpoint}${separator}page=${page}&pageSize=100`
    );

    if (response.data && response.data.length > 0) {
      allData = [...allData, ...response.data];
      page++;
      hasMore = response.totalPages ? page <= response.totalPages : false;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// ============================================================================
// SHEET FUNCTIONS
// ============================================================================

/**
 * List all sheets the user has access to
 */
export async function listSheets(): Promise<SmartsheetSheet[]> {
  return smartsheetFetchAll<SmartsheetSheet>('/sheets');
}

/**
 * Get a specific sheet by ID with all columns and rows
 */
export async function getSheet(
  sheetId: number | string,
  options: {
    includeAll?: boolean;
    rowIds?: number[];
    columnIds?: number[];
    pageSize?: number;
    page?: number;
  } = {}
): Promise<SmartsheetSheet> {
  const params = new URLSearchParams();

  if (options.includeAll) {
    params.append('include', 'all');
  }
  if (options.rowIds && options.rowIds.length > 0) {
    params.append('rowIds', options.rowIds.join(','));
  }
  if (options.columnIds && options.columnIds.length > 0) {
    params.append('columnIds', options.columnIds.join(','));
  }
  if (options.pageSize) {
    params.append('pageSize', options.pageSize.toString());
  }
  if (options.page) {
    params.append('page', options.page.toString());
  }

  const queryString = params.toString();
  const endpoint = `/sheets/${sheetId}${queryString ? `?${queryString}` : ''}`;

  return smartsheetFetch<SmartsheetSheet>(endpoint);
}

/**
 * Get all rows from a sheet (handles pagination)
 */
export async function getSheetRows(
  sheetId: number | string,
  options: {
    columnIds?: number[];
    includeAll?: boolean;
  } = {}
): Promise<SmartsheetRow[]> {
  const allRows: SmartsheetRow[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', '500');

    if (options.includeAll) {
      params.append('include', 'all');
    }
    if (options.columnIds && options.columnIds.length > 0) {
      params.append('columnIds', options.columnIds.join(','));
    }

    const sheet = await smartsheetFetch<SmartsheetSheet>(
      `/sheets/${sheetId}?${params.toString()}`
    );

    if (sheet.rows && sheet.rows.length > 0) {
      allRows.push(...sheet.rows);
      page++;
      // Check if we got a full page - if not, we're done
      hasMore = sheet.rows.length === 500;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

/**
 * Get columns for a sheet
 */
export async function getSheetColumns(
  sheetId: number | string
): Promise<SmartsheetColumn[]> {
  const response = await smartsheetFetch<{ data: SmartsheetColumn[] }>(
    `/sheets/${sheetId}/columns`
  );
  return response.data || [];
}

// ============================================================================
// ROW FUNCTIONS
// ============================================================================

/**
 * Add rows to a sheet
 */
export async function addRows(
  sheetId: number | string,
  rows: Partial<SmartsheetRow>[]
): Promise<SmartsheetRow[]> {
  const response = await smartsheetFetch<{ result: SmartsheetRow[] }>(
    `/sheets/${sheetId}/rows`,
    {
      method: 'POST',
      body: JSON.stringify(rows),
    }
  );
  return response.result || [];
}

/**
 * Update rows in a sheet
 */
export async function updateRows(
  sheetId: number | string,
  rows: Partial<SmartsheetRow>[]
): Promise<SmartsheetRow[]> {
  const response = await smartsheetFetch<{ result: SmartsheetRow[] }>(
    `/sheets/${sheetId}/rows`,
    {
      method: 'PUT',
      body: JSON.stringify(rows),
    }
  );
  return response.result || [];
}

/**
 * Delete rows from a sheet
 */
export async function deleteRows(
  sheetId: number | string,
  rowIds: number[]
): Promise<void> {
  await smartsheetFetch(
    `/sheets/${sheetId}/rows?ids=${rowIds.join(',')}`,
    {
      method: 'DELETE',
    }
  );
}

// ============================================================================
// WORKSPACE & FOLDER FUNCTIONS
// ============================================================================

/**
 * List all workspaces
 */
export async function listWorkspaces(): Promise<SmartsheetWorkspace[]> {
  return smartsheetFetchAll<SmartsheetWorkspace>('/workspaces');
}

/**
 * Get workspace contents (folders and sheets)
 */
export async function getWorkspace(
  workspaceId: number | string
): Promise<SmartsheetWorkspace & { sheets?: SmartsheetSheet[]; folders?: SmartsheetFolder[] }> {
  return smartsheetFetch(`/workspaces/${workspaceId}`);
}

/**
 * List folders in home
 */
export async function listHomeFolders(): Promise<SmartsheetFolder[]> {
  return smartsheetFetchAll<SmartsheetFolder>('/home/folders');
}

/**
 * Get folder contents
 */
export async function getFolder(
  folderId: number | string
): Promise<SmartsheetFolder> {
  return smartsheetFetch(`/folders/${folderId}`);
}

// ============================================================================
// USER FUNCTIONS
// ============================================================================

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<SmartsheetUser> {
  return smartsheetFetch('/users/me');
}

/**
 * List all users (admin only)
 */
export async function listUsers(): Promise<SmartsheetUser[]> {
  return smartsheetFetchAll<SmartsheetUser>('/users');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert sheet data to a more usable format (array of objects)
 */
export function sheetToObjects(sheet: SmartsheetSheet): Record<string, unknown>[] {
  if (!sheet.columns || !sheet.rows) {
    return [];
  }

  const columnMap = new Map<number, string>();
  sheet.columns.forEach(col => {
    columnMap.set(col.id, col.title);
  });

  return sheet.rows.map(row => {
    const obj: Record<string, unknown> = {
      _rowId: row.id,
      _rowNumber: row.rowNumber,
    };

    row.cells.forEach(cell => {
      const columnTitle = columnMap.get(cell.columnId);
      if (columnTitle) {
        obj[columnTitle] = cell.displayValue ?? cell.value ?? null;
      }
    });

    return obj;
  });
}

/**
 * Find column ID by title
 */
export function findColumnId(
  columns: SmartsheetColumn[],
  title: string
): number | undefined {
  const column = columns.find(
    col => col.title.toLowerCase() === title.toLowerCase()
  );
  return column?.id;
}

/**
 * Get cell value from a row by column title
 */
export function getCellValue(
  row: SmartsheetRow,
  columns: SmartsheetColumn[],
  columnTitle: string
): string | number | boolean | null | undefined {
  const columnId = findColumnId(columns, columnTitle);
  if (!columnId) return undefined;

  const cell = row.cells.find(c => c.columnId === columnId);
  return cell?.displayValue ?? cell?.value;
}

/**
 * Create cells array for a new row from an object
 */
export function objectToCells(
  obj: Record<string, unknown>,
  columns: SmartsheetColumn[]
): SmartsheetCell[] {
  const cells: SmartsheetCell[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;

    const columnId = findColumnId(columns, key);
    if (!columnId) continue;

    cells.push({
      columnId,
      value: value as string | number | boolean | null,
    });
  }

  return cells;
}

// Export test function
export async function testConnection(): Promise<{
  success: boolean;
  user?: SmartsheetUser;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    return { success: true, user };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
