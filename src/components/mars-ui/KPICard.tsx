'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { elevation, colors, shadows } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface KPICardProps {
  /** Title displayed at top of card */
  title: string;
  /** Main value - can be a number, string, or animated component */
  value: ReactNode;
  /** Subtitle displayed below value */
  subtitle: string;
  /** Icon to display in top right corner (optional) */
  icon?: ReactNode;
  /** Accent color for left bar and icon background */
  color: string;
  /** Animation delay in seconds */
  delay?: number;
  /** Whether this card is currently active/selected */
  isActive?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional trend indicator */
  trend?: TrendDirection;
  /** Optional trend label text */
  trendLabel?: string;
  /** Optional badge count (e.g., for notifications) */
  badge?: number;
  /** Invert trend color logic (e.g., for cost where down=good, up=bad) */
  invertTrendColor?: boolean;
  /** Tooltip text to show on hover */
  tooltip?: string;
  /** @deprecated - Always uses Apple Pro L1 surface now */
  gradient?: boolean;
  /** @deprecated - Glow is now automatic */
  glowIntensity?: 'none' | 'subtle' | 'strong';
}

// =============================================================================
// ANIMATED COUNTER COMPONENT
// =============================================================================

/**
 * Animated Counter Component for KPI values
 * Displays the value with a fade-in animation
 */
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}
      {value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </motion.span>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * KPICard Component - Apple Pro L1 Surface Design
 *
 * A luminous metric card with:
 * - L1 surface gradient background
 * - 30px 90px ambient shadow
 * - Inner highlight (inset 0 1px)
 * - Left accent bar with glow
 * - Icon with colored background micro-pill
 * - Large value display
 * - Subtitle
 * - Optional trend indicator
 *
 * @example
 * ```tsx
 * <KPICard
 *   title="Total Revenue"
 *   value={<AnimatedCounter value={125000} prefix="$" />}
 *   subtitle="This quarter"
 *   icon={<DollarIcon />}
 *   color={colors.accent.green}
 *   trend="up"
 *   trendLabel="+12%"
 *   onClick={() => filterBy('revenue')}
 * />
 * ```
 */
export function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
  delay = 0,
  isActive = false,
  onClick,
  trend,
  trendLabel,
  badge,
  invertTrendColor = false,
  tooltip,
  gradient: _gradient,        // Deprecated - ignored
  glowIntensity: _glowIntensity, // Deprecated - ignored
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{
        y: -2,
        boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 40px ${color}20`,
      }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer transition-all duration-150"
      style={{
        background: elevation.L1.background,
        boxShadow: isActive
          ? `0 30px 90px rgba(0,0,0,0.75), 0 0 30px ${color}20, inset 0 1px 0 rgba(255,255,255,0.10)`
          : elevation.L1.shadow,
        borderRadius: elevation.L1.radius,
        padding: '20px',
      }}
    >
      {/* Left accent bar with glow */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px]"
        style={{
          background: `linear-gradient(180deg, ${color} 0%, ${color}60 100%)`,
          boxShadow: `0 0 12px ${color}60`,
          borderRadius: `${elevation.L1.radius} 0 0 ${elevation.L1.radius}`,
        }}
      />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1">
          <span
            className="text-[12px] font-semibold uppercase tracking-[0.05em]"
            style={{ color: colors.text.secondary }}
          >
            {title}
          </span>
          {tooltip && (
            <div className="group relative">
              <svg className="w-3.5 h-3.5 cursor-help" style={{ color: colors.text.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div
                className="absolute left-0 top-6 w-64 p-2 text-xs rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10"
                style={{
                  background: elevation.L2.background,
                  boxShadow: elevation.L2.shadow,
                  color: colors.text.primary,
                }}
              >
                {tooltip}
              </div>
            </div>
          )}
        </div>
        {icon && (
          <div className="relative">
            {/* Icon micro-pill */}
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{ background: `${color}15` }}
            >
              <span style={{ color, opacity: 0.8 }}>
                {icon}
              </span>
            </div>
            {badge !== undefined && badge > 0 && (
              <div
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: colors.accent.red }}
              >
                <span className="text-[9px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="text-[28px] font-semibold mb-1 tracking-tight"
        style={{ color: colors.text.primary }}
      >
        {value}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[13px]" style={{ color: colors.text.secondary }}>{subtitle}</div>
        {trend && trendLabel && (
          <div
            className="flex items-center gap-1 text-[11px] font-semibold"
            style={{
              color: trend === 'up'
                ? invertTrendColor ? colors.accent.red : colors.accent.green
                : trend === 'down'
                ? invertTrendColor ? colors.accent.green : colors.accent.red
                : colors.text.muted
            }}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// COMMON ICONS
// =============================================================================

export const KPIIcons = {
  dollar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  trending: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  clipboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  ),
  checkCircle: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  folder: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
};

export default KPICard;
