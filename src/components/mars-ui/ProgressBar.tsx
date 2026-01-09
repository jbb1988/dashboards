'use client';

import { motion } from 'framer-motion';
import { tokens, colors } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';
export type ProgressColor = 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'orange';

export interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Progress bar color */
  color?: ProgressColor | string;
  /** Size variant */
  size?: ProgressSize;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: 'right' | 'inside';
  /** Animate on mount */
  animated?: boolean;
  /** Animation delay in seconds */
  delay?: number;
  /** Add glow effect for high values */
  glow?: boolean;
  /** Glow threshold (default 80) */
  glowThreshold?: number;
  /** Additional className */
  className?: string;
  /** Track background color */
  trackColor?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SIZE_MAP: Record<ProgressSize, { height: string; labelSize: string }> = {
  xs: { height: 'h-1', labelSize: 'text-[9px]' },
  sm: { height: 'h-1.5', labelSize: 'text-[10px]' },
  md: { height: 'h-2', labelSize: 'text-xs' },
  lg: { height: 'h-3', labelSize: 'text-sm' },
};

const COLOR_MAP: Record<ProgressColor, string> = {
  blue: colors.accent.blue,
  cyan: colors.accent.cyan,
  green: colors.accent.green,
  amber: colors.accent.amber,
  red: colors.accent.red,
  purple: colors.accent.purple,
  orange: colors.accent.orange,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ProgressBar Component - Animated progress indicator
 *
 * Features:
 * - Multiple sizes (xs, sm, md, lg)
 * - Semantic colors
 * - Optional animation on mount
 * - Optional glow effect for high values
 * - Label display options
 *
 * @example
 * ```tsx
 * <ProgressBar value={75} color="green" size="md" showLabel animated />
 * ```
 */
export function ProgressBar({
  value,
  color = 'blue',
  size = 'md',
  showLabel = false,
  labelPosition = 'right',
  animated = true,
  delay = 0,
  glow = false,
  glowThreshold = 80,
  className = '',
  trackColor,
}: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  // Get size classes
  const sizeClasses = SIZE_MAP[size];

  // Get color value (supports both named colors and custom hex)
  const fillColor = color in COLOR_MAP
    ? COLOR_MAP[color as ProgressColor]
    : color;

  // Should show glow
  const shouldGlow = glow && clampedValue >= glowThreshold;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Track */}
      <div
        className={`
          flex-1
          ${sizeClasses.height}
          ${trackColor || tokens.bg.input}
          rounded-full
          overflow-hidden
        `}
      >
        {/* Fill */}
        {animated ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clampedValue}%` }}
            transition={{ delay, duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full transition-all`}
            style={{
              backgroundColor: fillColor,
              boxShadow: shouldGlow ? `0 0 12px ${fillColor}50` : undefined,
            }}
          />
        ) : (
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${clampedValue}%`,
              backgroundColor: fillColor,
              boxShadow: shouldGlow ? `0 0 12px ${fillColor}50` : undefined,
            }}
          />
        )}
      </div>

      {/* Label */}
      {showLabel && labelPosition === 'right' && (
        <span className={`${sizeClasses.labelSize} ${tokens.text.muted} tabular-nums min-w-[32px] text-right`}>
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}

// =============================================================================
// DISTRIBUTION BAR COMPONENT
// =============================================================================

export interface DistributionSegment {
  value: number;
  color: string;
  label: string;
}

export interface DistributionBarProps {
  /** Segments to display */
  segments: DistributionSegment[];
  /** Total value (for percentage calculation) */
  total: number;
  /** Size variant */
  size?: ProgressSize;
  /** Animate on mount */
  animated?: boolean;
  /** Show legend below */
  showLegend?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * DistributionBar - Multi-segment progress bar
 *
 * @example
 * ```tsx
 * <DistributionBar
 *   segments={[
 *     { value: 5, color: '#E5484D', label: 'Critical' },
 *     { value: 10, color: '#D4A72C', label: 'High' },
 *     { value: 20, color: '#5B8DEF', label: 'Medium' },
 *     { value: 15, color: '#30A46C', label: 'Low' },
 *   ]}
 *   total={50}
 *   showLegend
 * />
 * ```
 */
export function DistributionBar({
  segments,
  total,
  size = 'md',
  animated = true,
  showLegend = false,
  className = '',
}: DistributionBarProps) {
  if (total === 0) return null;

  const sizeClasses = SIZE_MAP[size];
  const nonZeroSegments = segments.filter(s => s.value > 0);

  return (
    <div className={className}>
      {/* Bar */}
      <div
        className={`
          ${sizeClasses.height}
          ${tokens.bg.input}
          rounded-full
          overflow-hidden
          flex
        `}
      >
        {nonZeroSegments.map((segment, index) => {
          const percent = (segment.value / total) * 100;
          const isFirst = index === 0;
          const isLast = index === nonZeroSegments.length - 1;

          return animated ? (
            <motion.div
              key={segment.label}
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ delay: 0.1 * index, duration: 0.4, ease: 'easeOut' }}
              className={`
                h-full
                ${isFirst ? 'rounded-l-full' : ''}
                ${isLast ? 'rounded-r-full' : ''}
              `}
              style={{ backgroundColor: segment.color }}
            />
          ) : (
            <div
              key={segment.label}
              className={`
                h-full
                ${isFirst ? 'rounded-l-full' : ''}
                ${isLast ? 'rounded-r-full' : ''}
              `}
              style={{
                width: `${percent}%`,
                backgroundColor: segment.color,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center gap-4 mt-2">
          {nonZeroSegments.map(segment => (
            <div key={segment.label} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className={`text-xs ${tokens.text.secondary}`}>
                {segment.label}:{' '}
                <span className={`font-semibold ${tokens.text.primary}`}>
                  {segment.value}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// URGENCY BAR COMPONENT
// =============================================================================

export interface UrgencyBarProps {
  /** Days until deadline (can be negative for overdue) */
  daysUntilDeadline: number;
  /** Max days to show (default 365) */
  maxDays?: number;
  /** Size */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
}

/**
 * UrgencyBar - Visual indicator for deadline urgency
 *
 * Color coding:
 * - Red: Overdue or < 90 days
 * - Amber: 90-180 days
 * - Green: 180+ days
 */
export function UrgencyBar({
  daysUntilDeadline,
  maxDays = 365,
  size = 'sm',
  className = '',
}: UrgencyBarProps) {
  // Calculate fill percentage
  const fillPercent = Math.max(5, Math.min(100, (1 - daysUntilDeadline / maxDays) * 100));

  // Determine color based on urgency
  let fillColor: string;
  if (daysUntilDeadline < 0) {
    fillColor = colors.accent.red;
  } else if (daysUntilDeadline <= 90) {
    fillColor = colors.accent.red;
  } else if (daysUntilDeadline <= 180) {
    fillColor = colors.accent.amber;
  } else {
    fillColor = colors.accent.green;
  }

  const height = size === 'sm' ? 'h-[3px]' : 'h-1.5';

  return (
    <div className={`w-10 ${height} rounded-full bg-white/10 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${fillPercent}%`,
          backgroundColor: fillColor,
        }}
      />
    </div>
  );
}

export default ProgressBar;
