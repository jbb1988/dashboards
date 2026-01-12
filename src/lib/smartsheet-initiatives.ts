/**
 * Smartsheet Strategic Initiatives - Data Transformation Layer
 * Transforms raw Smartsheet data into structured Initiative objects
 */

import { getSheet, updateRows, SmartsheetSheet, SmartsheetRow, SmartsheetCell } from './smartsheet';

// Column IDs for the Strategic Initiatives sheet
const COLUMN_IDS = {
  TITLE: 8031259574620036,
  SI_LEVEL: 712910180142980,
  TIMEFRAME: 8594209528041348,
  RESP: 1557335110274948,
  STATUS: 8312734551330692,
  PERCENT_COMPLETE: 3809134923960196,
  DUE_DATE: 8875684504752004,
  DESCRIPTION: 79591482544004,
  COMMENTS: 4583191109914500,
  MEASUREMENT: 994385156853636,
  TARGET: 5497984784224132,
  LAST_UPDATED: 6060934737645444,
  UPDATED_BY: 3246184970538884,
  DEPENDENCY: 4372084877381508,
  PRIORITY_26: 4784344492887940,
} as const;

// Pillar definitions with colors
export const PILLARS = {
  'REVENUE GROWTH': { color: '#38BDF8', icon: 'chart-line' },
  'OPERATING RESULTS': { color: '#22C55E', icon: 'cog' },
  'CUSTOMER SATISFACTION': { color: '#F59E0B', icon: 'users' },
  'TEAM MEMBER SATISFACTION': { color: '#8B5CF6', icon: 'heart' },
} as const;

export type PillarName = keyof typeof PILLARS;

// Status mapping (Smartsheet uses colors)
export const STATUS_MAP = {
  'Green': { label: 'On Track', color: '#22C55E' },
  'Yellow': { label: 'At Risk', color: '#F59E0B' },
  'Red': { label: 'Critical', color: '#EF4444' },
  'Gray': { label: 'Complete', color: '#64748B' },
} as const;

export type StatusKey = keyof typeof STATUS_MAP;

// Percent complete mapping
const PERCENT_MAP: Record<string, number> = {
  'Empty': 0,
  'Quarter': 25,
  'Half': 50,
  'Three Quarter': 75,
  'Full': 100,
};

// Timeframe mapping
export const TIMEFRAME_MAP = {
  '30-60': { label: '30-60 Days', color: '#F59E0B', sortOrder: 1 },
  '90': { label: '90 Days', color: '#38BDF8', sortOrder: 2 },
  '90+': { label: '90+ Days', color: '#22C55E', sortOrder: 3 },
} as const;

export type TimeframeKey = keyof typeof TIMEFRAME_MAP;

// SI Level definitions
export const SI_LEVELS = {
  'SI-1': { label: 'Pillar', description: 'Top-level company pillar' },
  'SI-2': { label: 'Initiative', description: 'Major strategic initiative' },
  'SI-3': { label: 'Objective', description: 'Supporting objective' },
  'SI-4': { label: 'Action', description: 'Specific action item' },
} as const;

export type SILevel = keyof typeof SI_LEVELS;

// Initiative interface
export interface Initiative {
  id: number;
  rowNumber: number;
  title: string;
  pillar: PillarName | null;
  siLevel: SILevel;
  owner: string | null;
  status: StatusKey | null;
  statusLabel: string;
  statusColor: string;
  timeframe: TimeframeKey | null;
  timeframeLabel: string;
  percentComplete: number;
  dueDate: string | null;
  description: string | null;
  comments: string | null;
  measurement: string | null;
  target: string | null;
  lastUpdated: string | null;
  updatedBy: string | null;
  dependency: string | null;
  priority: string | null;
  isPillarRow: boolean;
  parentPillar: PillarName | null;
}

// Summary statistics
export interface InitiativesSummary {
  total: number;
  byStatus: Record<string, number>;
  byTimeframe: Record<string, number>;
  byPillar: Record<string, {
    total: number;
    onTrack: number;
    atRisk: number;
    critical: number;
    complete: number;
    avgProgress: number;
  }>;
}

// Filter options
export interface InitiativesFilters {
  pillar?: PillarName | null;
  owner?: string | null;
  status?: StatusKey | null;
  timeframe?: TimeframeKey | null;
  siLevel?: SILevel | null;
  search?: string | null;
}

// Helper to get cell value by column ID
function getCellValue(row: SmartsheetRow, columnId: number): string | number | boolean | null {
  const cell = row.cells.find(c => c.columnId === columnId);
  return cell?.displayValue ?? cell?.value ?? null;
}

// Transform a single row to Initiative
function transformRow(row: SmartsheetRow, currentPillar: PillarName | null): Initiative {
  const title = String(getCellValue(row, COLUMN_IDS.TITLE) || '');
  const siLevel = (getCellValue(row, COLUMN_IDS.SI_LEVEL) || 'SI-3') as SILevel;
  const status = getCellValue(row, COLUMN_IDS.STATUS) as StatusKey | null;
  const percentStr = getCellValue(row, COLUMN_IDS.PERCENT_COMPLETE) as string;
  const timeframe = getCellValue(row, COLUMN_IDS.TIMEFRAME) as TimeframeKey | null;

  // Check if this is a pillar row
  const isPillarRow = siLevel === 'SI-1' && Object.keys(PILLARS).includes(title);

  // Get status info
  const statusInfo = status ? STATUS_MAP[status] : null;

  return {
    id: row.id,
    rowNumber: row.rowNumber,
    title,
    pillar: isPillarRow ? title as PillarName : null,
    siLevel,
    owner: getCellValue(row, COLUMN_IDS.RESP) as string | null,
    status,
    statusLabel: statusInfo?.label || 'Unknown',
    statusColor: statusInfo?.color || '#64748B',
    timeframe,
    timeframeLabel: timeframe ? TIMEFRAME_MAP[timeframe]?.label || timeframe : '',
    percentComplete: PERCENT_MAP[percentStr] ?? 0,
    dueDate: getCellValue(row, COLUMN_IDS.DUE_DATE) as string | null,
    description: getCellValue(row, COLUMN_IDS.DESCRIPTION) as string | null,
    comments: getCellValue(row, COLUMN_IDS.COMMENTS) as string | null,
    measurement: getCellValue(row, COLUMN_IDS.MEASUREMENT) as string | null,
    target: getCellValue(row, COLUMN_IDS.TARGET) as string | null,
    lastUpdated: getCellValue(row, COLUMN_IDS.LAST_UPDATED) as string | null,
    updatedBy: getCellValue(row, COLUMN_IDS.UPDATED_BY) as string | null,
    dependency: getCellValue(row, COLUMN_IDS.DEPENDENCY) as string | null,
    priority: getCellValue(row, COLUMN_IDS.PRIORITY_26) as string | null,
    isPillarRow,
    parentPillar: isPillarRow ? title as PillarName : currentPillar,
  };
}

// Get sheet ID from environment
function getSheetId(): string {
  const sheetId = process.env.SMARTSHEET_MANAGEMENT_SHEET_ID;
  if (!sheetId) {
    throw new Error('SMARTSHEET_MANAGEMENT_SHEET_ID not configured');
  }
  return sheetId;
}

// Fetch and transform all initiatives
export async function fetchInitiatives(filters?: InitiativesFilters): Promise<{
  initiatives: Initiative[];
  summary: InitiativesSummary;
  owners: string[];
  lastSynced: string;
}> {
  const sheetId = getSheetId();
  const sheet = await getSheet(sheetId, { includeAll: true });

  if (!sheet.rows) {
    return {
      initiatives: [],
      summary: createEmptySummary(),
      owners: [],
      lastSynced: new Date().toISOString(),
    };
  }

  // Transform rows, tracking current pillar
  let currentPillar: PillarName | null = null;
  const allInitiatives: Initiative[] = [];
  const ownersSet = new Set<string>();

  for (const row of sheet.rows) {
    const initiative = transformRow(row, currentPillar);

    // Update current pillar context
    if (initiative.isPillarRow && initiative.pillar) {
      currentPillar = initiative.pillar;
      initiative.parentPillar = currentPillar;
    } else {
      initiative.parentPillar = currentPillar;
    }

    // Track owners
    if (initiative.owner) {
      ownersSet.add(initiative.owner);
    }

    allInitiatives.push(initiative);
  }

  // Apply filters
  let filteredInitiatives = allInitiatives;

  if (filters) {
    filteredInitiatives = allInitiatives.filter(init => {
      // Skip pillar rows from filtering (they're headers)
      if (init.isPillarRow) return true;

      if (filters.pillar && init.parentPillar !== filters.pillar) return false;
      if (filters.owner && init.owner !== filters.owner) return false;
      if (filters.status && init.status !== filters.status) return false;
      if (filters.timeframe && init.timeframe !== filters.timeframe) return false;
      if (filters.siLevel && init.siLevel !== filters.siLevel) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = init.title.toLowerCase().includes(searchLower);
        const matchesDesc = init.description?.toLowerCase().includes(searchLower);
        const matchesOwner = init.owner?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDesc && !matchesOwner) return false;
      }
      return true;
    });
  }

  // Calculate summary (excluding pillar rows)
  const summary = calculateSummary(filteredInitiatives.filter(i => !i.isPillarRow));

  return {
    initiatives: filteredInitiatives,
    summary,
    owners: Array.from(ownersSet).sort(),
    lastSynced: new Date().toISOString(),
  };
}

// Calculate summary statistics
function calculateSummary(initiatives: Initiative[]): InitiativesSummary {
  const summary: InitiativesSummary = {
    total: initiatives.length,
    byStatus: {},
    byTimeframe: {},
    byPillar: {},
  };

  // Initialize pillar stats
  for (const pillar of Object.keys(PILLARS)) {
    summary.byPillar[pillar] = {
      total: 0,
      onTrack: 0,
      atRisk: 0,
      critical: 0,
      complete: 0,
      avgProgress: 0,
    };
  }

  let totalProgress = 0;

  for (const init of initiatives) {
    // Status counts
    if (init.status) {
      summary.byStatus[init.status] = (summary.byStatus[init.status] || 0) + 1;
    }

    // Timeframe counts
    if (init.timeframe) {
      summary.byTimeframe[init.timeframe] = (summary.byTimeframe[init.timeframe] || 0) + 1;
    }

    // Pillar stats
    if (init.parentPillar && summary.byPillar[init.parentPillar]) {
      const pillarStats = summary.byPillar[init.parentPillar];
      pillarStats.total++;

      if (init.status === 'Green') pillarStats.onTrack++;
      else if (init.status === 'Yellow') pillarStats.atRisk++;
      else if (init.status === 'Red') pillarStats.critical++;
      else if (init.status === 'Gray') pillarStats.complete++;

      totalProgress += init.percentComplete;
    }
  }

  // Calculate average progress per pillar
  for (const pillar of Object.keys(PILLARS)) {
    const stats = summary.byPillar[pillar];
    if (stats.total > 0) {
      const pillarInitiatives = initiatives.filter(i => i.parentPillar === pillar);
      const totalPillarProgress = pillarInitiatives.reduce((sum, i) => sum + i.percentComplete, 0);
      stats.avgProgress = Math.round(totalPillarProgress / stats.total);
    }
  }

  return summary;
}

function createEmptySummary(): InitiativesSummary {
  return {
    total: 0,
    byStatus: {},
    byTimeframe: {},
    byPillar: Object.fromEntries(
      Object.keys(PILLARS).map(p => [p, {
        total: 0, onTrack: 0, atRisk: 0, critical: 0, complete: 0, avgProgress: 0
      }])
    ),
  };
}

// Update an initiative
export async function updateInitiative(
  rowId: number,
  updates: Partial<{
    status: StatusKey;
    timeframe: TimeframeKey;
    percentComplete: string;
    comments: string;
    description: string;
  }>
): Promise<void> {
  const sheetId = getSheetId();

  const cells: SmartsheetCell[] = [];

  if (updates.status !== undefined) {
    cells.push({ columnId: COLUMN_IDS.STATUS, value: updates.status });
  }
  if (updates.timeframe !== undefined) {
    cells.push({ columnId: COLUMN_IDS.TIMEFRAME, value: updates.timeframe });
  }
  if (updates.percentComplete !== undefined) {
    cells.push({ columnId: COLUMN_IDS.PERCENT_COMPLETE, value: updates.percentComplete });
  }
  if (updates.comments !== undefined) {
    cells.push({ columnId: COLUMN_IDS.COMMENTS, value: updates.comments });
  }
  if (updates.description !== undefined) {
    cells.push({ columnId: COLUMN_IDS.DESCRIPTION, value: updates.description });
  }

  if (cells.length > 0) {
    await updateRows(sheetId, [{ id: rowId, cells }]);
  }
}

// Export column mapping for reference
export const COLUMN_MAPPING = {
  title: 'STRATEGIC INITIATIVE',
  siLevel: 'SI Level',
  timeframe: '30-60-90',
  owner: 'RESP.',
  status: 'Status',
  percentComplete: '% Complete',
  dueDate: 'DATE TO BE COMPLETED',
  description: 'Actions/Description',
  comments: 'Resolution / Comments',
  measurement: 'MEASUREMENT',
  target: 'TARGET PERFORMANCE',
};
