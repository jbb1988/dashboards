'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { tokens, colors, shadows } from './tokens';

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
  /** Enable gradient background effect (Mind-Muscle style) */
  gradient?: boolean;
  /** Glow intensity for the card */
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
 * KPICard Component - Executive Command Center Design
 *
 * A beautiful, interactive metric card with:
 * - Left accent bar in custom color
 * - Icon with colored background
 * - Large value display
 * - Subtitle
 * - Optional trend indicator
 * - Click-to-filter functionality
 * - Framer Motion animations
 *
 * @example
 * ```tsx
 * <KPICard
 *   title="Total Revenue"
 *   value={<AnimatedCounter value={125000} prefix="$" />}
 *   subtitle="This quarter"
 *   icon={<DollarIcon />}
 *   color="#30A46C"
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
  gradient = true,
  glowIntensity = 'subtle',
}: KPICardProps) {
  // Gradient styling inspired by Mind-Muscle project
  const getGradientStyle = () => {
    if (!gradient) return {};
    const glowStrength = {
      none: '0',
      subtle: '0.1',
      strong: '0.2',
    }[glowIntensity];
    return {
      background: `linear-gradient(135deg, ${color}15 0%, #1B1F39 50%, #151821 100%)`,
      borderColor: `${color}30`,
      boxShadow: `0 8px 32px ${color}${glowStrength === '0.2' ? '30' : glowStrength === '0.1' ? '20' : '00'}, inset 0 1px 0 ${color}15`,
    };
  };

  const gradientStyle = getGradientStyle();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{
        y: -2,
        boxShadow: gradient
          ? `0 16px 40px ${color}25, 0 0 30px ${color}15`
          : `0 12px 32px rgba(0,0,0,0.4), 0 0 20px ${color}15`,
      }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all duration-150
        ${gradient ? '' : `${tokens.bg.card} border ${tokens.border.subtle} ${tokens.shadow.card}`}
        ${isActive
          ? `${tokens.bg.elevated} shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_20px_${color}15]`
          : `hover:${tokens.bg.elevated} hover:border-white/[0.1]`
        }
      `}
      style={gradient ? { ...gradientStyle, border: `1px solid ${color}30` } : undefined}
    >
      {/* Specular highlight (top edge) - only for gradient variant */}
      {gradient && (
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent 10%, ${color}40 50%, transparent 90%)`,
          }}
        />
      )}

      {/* Left accent bar - always visible */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: gradient ? `linear-gradient(180deg, ${color} 0%, ${color}60 100%)` : color }}
      />

      <div className="flex items-start justify-between mb-3">
        <span className={`text-[12px] font-semibold ${tokens.text.muted} uppercase tracking-[0.08em]`}>
          {title}
        </span>
        {icon && (
          <div className="relative">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${color}15` }}
            >
              <span style={{ color }} className="opacity-60">
                {icon}
              </span>
            </div>
            {badge !== undefined && badge > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`text-[28px] font-semibold ${tokens.text.primary} mb-1 tracking-tight`}>
        {value}
      </div>

      <div className="flex items-center justify-between">
        <div className={`text-[13px] ${tokens.text.secondary}`}>{subtitle}</div>
        {trend && trendLabel && (
          <div
            className={`flex items-center gap-1 text-[11px] font-medium ${
              trend === 'up'
                ? 'text-[#22C55E]'
                : trend === 'down'
                ? 'text-[#EF4444]'
                : tokens.text.muted
            }`}
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
