'use client';

import { ReactNode } from 'react';
import { tokens, colors } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export type BadgeVariant = 'status' | 'category' | 'count' | 'outline';
export type BadgeColor = 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'orange' | 'gray';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  /** Badge visual variant */
  variant?: BadgeVariant;
  /** Badge color */
  color?: BadgeColor;
  /** Badge size */
  size?: BadgeSize;
  /** Badge content */
  children: ReactNode;
  /** Additional className */
  className?: string;
  /** Optional dot indicator */
  dot?: boolean;
  /** Optional icon (left side) */
  icon?: ReactNode;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLOR_MAP: Record<BadgeColor, { bg: string; text: string; border: string; dot: string }> = {
  blue: {
    bg: 'bg-[#5B8DEF]/10',
    text: 'text-[#5B8DEF]',
    border: 'border-[#5B8DEF]/30',
    dot: 'bg-[#5B8DEF]',
  },
  cyan: {
    bg: 'bg-[#38BDF8]/10',
    text: 'text-[#38BDF8]',
    border: 'border-[#38BDF8]/30',
    dot: 'bg-[#38BDF8]',
  },
  green: {
    bg: 'bg-[#30A46C]/10',
    text: 'text-[#30A46C]',
    border: 'border-[#30A46C]/30',
    dot: 'bg-[#30A46C]',
  },
  amber: {
    bg: 'bg-[#D4A72C]/10',
    text: 'text-[#D4A72C]',
    border: 'border-[#D4A72C]/30',
    dot: 'bg-[#D4A72C]',
  },
  red: {
    bg: 'bg-[#E5484D]/10',
    text: 'text-[#E5484D]',
    border: 'border-[#E5484D]/30',
    dot: 'bg-[#E5484D]',
  },
  purple: {
    bg: 'bg-[#8B5CF6]/10',
    text: 'text-[#8B5CF6]',
    border: 'border-[#8B5CF6]/30',
    dot: 'bg-[#8B5CF6]',
  },
  orange: {
    bg: 'bg-[#F97316]/10',
    text: 'text-[#F97316]',
    border: 'border-[#F97316]/30',
    dot: 'bg-[#F97316]',
  },
  gray: {
    bg: 'bg-white/10',
    text: 'text-[#A8AEBB]',
    border: 'border-white/20',
    dot: 'bg-[#7C8291]',
  },
};

const SIZE_MAP: Record<BadgeSize, { text: string; padding: string; dot: string }> = {
  xs: {
    text: 'text-[9px]',
    padding: 'px-1.5 py-0.5',
    dot: 'w-1.5 h-1.5',
  },
  sm: {
    text: 'text-[10px]',
    padding: 'px-2 py-0.5',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    text: 'text-[11px]',
    padding: 'px-2.5 py-1',
    dot: 'w-2 h-2',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Badge Component - Status, category, and count indicators
 *
 * Variants:
 * - status: Colored background with rounded-full
 * - category: Subtle background with rounded corners
 * - count: Solid background circle for numbers
 * - outline: Border only
 *
 * @example
 * ```tsx
 * <Badge variant="status" color="green">Complete</Badge>
 * <Badge variant="category" color="gray">Renewal</Badge>
 * <Badge variant="count" color="red">3</Badge>
 * ```
 */
export function Badge({
  variant = 'status',
  color = 'gray',
  size = 'sm',
  children,
  className = '',
  dot = false,
  icon,
}: BadgeProps) {
  const colorClasses = COLOR_MAP[color];
  const sizeClasses = SIZE_MAP[size];

  const getVariantClasses = () => {
    switch (variant) {
      case 'status':
        return `${colorClasses.bg} ${colorClasses.text} rounded-full`;
      case 'category':
        return `bg-white/10 ${tokens.text.secondary} rounded`;
      case 'count':
        return `${colorClasses.dot} text-white rounded-full min-w-[20px] text-center`;
      case 'outline':
        return `bg-transparent border ${colorClasses.border} ${colorClasses.text} rounded-full`;
      default:
        return `${colorClasses.bg} ${colorClasses.text} rounded-full`;
    }
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${sizeClasses.padding}
        ${sizeClasses.text}
        font-medium
        ${getVariantClasses()}
        ${className}
      `.trim()}
    >
      {dot && (
        <span className={`${sizeClasses.dot} rounded-full ${colorClasses.dot}`} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// =============================================================================
// STATUS DOT COMPONENT
// =============================================================================

export interface StatusDotProps {
  /** Dot color */
  color: BadgeColor;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Pulse animation */
  pulse?: boolean;
  /** Additional className */
  className?: string;
}

const DOT_SIZES = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

/**
 * StatusDot - Simple colored dot indicator
 */
export function StatusDot({ color, size = 'md', pulse = false, className = '' }: StatusDotProps) {
  const colorClass = COLOR_MAP[color].dot;
  const sizeClass = DOT_SIZES[size];

  return (
    <span
      className={`
        ${sizeClass}
        ${colorClass}
        rounded-full
        flex-shrink-0
        ${pulse ? 'animate-pulse' : ''}
        ${className}
      `.trim()}
    />
  );
}

// =============================================================================
// COUNT BADGE COMPONENT
// =============================================================================

export interface CountBadgeProps {
  /** Count value */
  count: number;
  /** Max count before showing "9+" */
  max?: number;
  /** Color */
  color?: BadgeColor;
  /** Size */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
}

/**
 * CountBadge - Numeric indicator badge
 */
export function CountBadge({
  count,
  max = 9,
  color = 'red',
  size = 'sm',
  className = '',
}: CountBadgeProps) {
  if (count <= 0) return null;

  const colorClass = COLOR_MAP[color].dot;
  const sizeClasses = size === 'sm'
    ? 'w-4 h-4 text-[9px]'
    : 'w-5 h-5 text-[10px]';

  return (
    <span
      className={`
        ${sizeClasses}
        ${colorClass}
        text-white
        font-bold
        rounded-full
        flex items-center justify-center
        ${className}
      `.trim()}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

export default Badge;
