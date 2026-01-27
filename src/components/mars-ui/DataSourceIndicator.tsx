'use client';

import { useEffect, useState } from 'react';
import { colors } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export type DataSourceType = 'salesforce' | 'netsuite' | 'asana' | 'docusign' | 'pandadoc' | 'supabase' | 'claude';

export interface DataSourceIndicatorProps {
  /** The data source type */
  source: DataSourceType;
  /** ISO timestamp of when data was last updated */
  lastUpdated: string | null;
  /** Optional custom label override */
  label?: string;
  /** Show detailed sync time (default false) */
  showSyncTime?: boolean;
  /** Last sync timestamp for detailed view */
  lastSyncTime?: string | null;
  /** Whether data is currently syncing/loading */
  isSyncing?: boolean;
}

// =============================================================================
// SOURCE CONFIGURATION
// =============================================================================

const sourceConfig: Record<DataSourceType, { label: string; color: string; icon: JSX.Element }> = {
  salesforce: {
    label: 'Salesforce',
    color: '#00A1E0', // Salesforce blue
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.005 4.539a4.124 4.124 0 013.024-1.339c1.594 0 2.993.928 3.656 2.27a4.625 4.625 0 011.715-.331c2.541 0 4.6 2.057 4.6 4.595 0 2.537-2.059 4.594-4.6 4.594-.254 0-.503-.021-.746-.062a3.285 3.285 0 01-2.904 1.734 3.31 3.31 0 01-1.162-.213 4.067 4.067 0 01-3.588 2.163 4.088 4.088 0 01-3.823-2.618 3.818 3.818 0 01-.609.049c-2.12 0-3.838-1.717-3.838-3.835 0-1.552.926-2.888 2.256-3.492a3.94 3.94 0 01-.165-1.127c0-2.178 1.77-3.943 3.953-3.943 1.259 0 2.38.589 3.101 1.505l.13.05z"/>
      </svg>
    ),
  },
  netsuite: {
    label: 'NetSuite',
    color: '#1A5276', // NetSuite blue
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  asana: {
    label: 'Asana',
    color: '#F06A6A', // Asana coral
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.78 12.653c-2.425 0-4.39 1.966-4.39 4.39 0 2.424 1.965 4.39 4.39 4.39 2.424 0 4.39-1.966 4.39-4.39 0-2.424-1.966-4.39-4.39-4.39zM5.22 12.653c-2.424 0-4.39 1.966-4.39 4.39 0 2.424 1.966 4.39 4.39 4.39 2.425 0 4.39-1.966 4.39-4.39 0-2.424-1.965-4.39-4.39-4.39zM12 2.567c-2.424 0-4.39 1.966-4.39 4.39 0 2.424 1.966 4.39 4.39 4.39 2.424 0 4.39-1.966 4.39-4.39 0-2.424-1.966-4.39-4.39-4.39z"/>
      </svg>
    ),
  },
  docusign: {
    label: 'DocuSign',
    color: '#FFCC00', // DocuSign yellow
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 6.5l-10 7L2 6.5V5l10 7 10-7v1.5zM2 18V8l10 7 10-7v10H2z"/>
      </svg>
    ),
  },
  pandadoc: {
    label: 'PandaDoc',
    color: '#5BBB4E', // PandaDoc green
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    ),
  },
  supabase: {
    label: 'Database',
    color: '#3ECF8E', // Supabase green
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ),
  },
  claude: {
    label: 'Claude AI',
    color: '#A855F7', // Purple for AI
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 110 2h-1.27c-.53 2.3-2.37 4.1-4.73 4.63V22h-2v-1.37C11.7 20.1 9.86 18.3 9.33 16H8a1 1 0 110-2h1a7 7 0 017-7h-1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
      </svg>
    ),
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTimeAgo(timestamp: string): string {
  const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isStale(timestamp: string): boolean {
  const hours = (Date.now() - new Date(timestamp).getTime()) / 3600000;
  return hours > 24;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * DataSourceIndicator - Shows data source status with pulsing dot
 *
 * Displays:
 * - Pulsing colored dot (source-specific color)
 * - Data source name
 * - "Updated X min ago" relative timestamp
 * - Optional sync time warning
 *
 * @example
 * ```tsx
 * <DataSourceIndicator
 *   source="salesforce"
 *   lastUpdated={data.lastUpdated}
 * />
 * ```
 */
export function DataSourceIndicator({
  source,
  lastUpdated,
  label,
  showSyncTime = false,
  lastSyncTime,
  isSyncing = false,
}: DataSourceIndicatorProps) {
  const config = sourceConfig[source];
  const displayLabel = label || config.label;

  // Force re-render every minute to update "X min ago"
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-right">
      {/* Source label with pulsing dot */}
      <div
        className="text-[12px] flex items-center gap-2 justify-end font-medium"
        style={{ color: colors.text.secondary }}
      >
        <span
          className={`w-2 h-2 rounded-full ${isSyncing ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: isSyncing ? colors.accent.amber : config.color,
            boxShadow: `0 0 8px ${isSyncing ? colors.accent.amber : config.color}60`,
          }}
        />
        <span style={{ color: config.color }}>{config.icon}</span>
        {displayLabel}
      </div>

      {/* Updated timestamp */}
      <div
        className="text-[13px] font-semibold mt-0.5"
        style={{ color: colors.text.primary }}
      >
        {isSyncing ? (
          'Syncing...'
        ) : lastUpdated ? (
          `Updated ${formatTimeAgo(lastUpdated)}`
        ) : (
          'Loading...'
        )}
      </div>

      {/* Optional sync time (stale warning) */}
      {showSyncTime && lastSyncTime && (
        <div
          className="text-[11px] mt-0.5"
          style={{ color: isStale(lastSyncTime) ? colors.accent.amber : colors.text.muted }}
        >
          Last sync: {formatTimeAgo(lastSyncTime)}
        </div>
      )}
    </div>
  );
}

export default DataSourceIndicator;
