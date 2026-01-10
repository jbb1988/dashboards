'use client';

import { motion } from 'framer-motion';
import { tokens, colors } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded';

export interface SkeletonProps {
  /** Variant type */
  variant?: SkeletonVariant;
  /** Width - can be number (px) or string (e.g., '100%') */
  width?: number | string;
  /** Height - can be number (px) or string */
  height?: number | string;
  /** Additional className */
  className?: string;
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none';
}

export interface SkeletonGroupProps {
  /** Number of skeleton items to render */
  count?: number;
  /** Gap between items */
  gap?: number;
  /** Children or single skeleton config */
  children?: React.ReactNode;
  /** Additional className */
  className?: string;
}

// =============================================================================
// BASE SKELETON COMPONENT
// =============================================================================

/**
 * Skeleton - Loading placeholder with shimmer animation
 *
 * @example
 * ```tsx
 * <Skeleton variant="text" width={200} />
 * <Skeleton variant="circular" width={40} height={40} />
 * <Skeleton variant="rectangular" width="100%" height={200} />
 * ```
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'pulse',
}: SkeletonProps) {
  // Default dimensions based on variant
  const defaultDimensions = {
    text: { width: '100%', height: 16 },
    circular: { width: 40, height: 40 },
    rectangular: { width: '100%', height: 100 },
    rounded: { width: '100%', height: 40 },
  };

  const finalWidth = width ?? defaultDimensions[variant].width;
  const finalHeight = height ?? defaultDimensions[variant].height;

  // Border radius based on variant
  const radiusClass = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    rounded: 'rounded-xl',
  }[variant];

  // Animation classes
  const animationClass = {
    pulse: 'animate-pulse',
    wave: '', // Custom wave animation
    none: '',
  }[animation];

  const baseStyle = {
    width: typeof finalWidth === 'number' ? `${finalWidth}px` : finalWidth,
    height: typeof finalHeight === 'number' ? `${finalHeight}px` : finalHeight,
    backgroundColor: colors.bg.elevated,
  };

  if (animation === 'wave') {
    return (
      <div
        className={`relative overflow-hidden ${radiusClass} ${className}`}
        style={baseStyle}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.border.subtle}40, transparent)`,
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${radiusClass} ${animationClass} ${className}`}
      style={baseStyle}
    />
  );
}

// =============================================================================
// SKELETON GROUP
// =============================================================================

/**
 * SkeletonGroup - Render multiple skeletons with consistent spacing
 */
export function SkeletonGroup({
  count = 3,
  gap = 12,
  children,
  className = '',
}: SkeletonGroupProps) {
  return (
    <div className={`flex flex-col ${className}`} style={{ gap }}>
      {children
        ? Array.from({ length: count }).map((_, i) => (
            <div key={i}>{children}</div>
          ))
        : Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} variant="text" />
          ))}
    </div>
  );
}

// =============================================================================
// PRESET SKELETON COMPONENTS
// =============================================================================

/**
 * KPICardSkeleton - Loading state for KPI cards
 */
export function KPICardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-5 ${tokens.bg.card} border ${tokens.border.subtle} ${className}`}
    >
      {/* Left accent bar */}
      <Skeleton
        variant="rectangular"
        width={4}
        height="100%"
        className="absolute left-0 top-0 bottom-0 rounded-l-xl"
      />

      {/* Title */}
      <div className="flex items-start justify-between mb-3">
        <Skeleton variant="text" width={80} height={12} />
        <Skeleton variant="circular" width={32} height={32} />
      </div>

      {/* Value */}
      <Skeleton variant="text" width={120} height={28} className="mb-2" />

      {/* Subtitle */}
      <Skeleton variant="text" width={100} height={12} />
    </div>
  );
}

/**
 * TableRowSkeleton - Loading state for table rows
 */
export function TableRowSkeleton({
  columns = 5,
  className = '',
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid items-center gap-4 px-5 py-4 border-b ${tokens.border.subtle} ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === 0 ? '80%' : '60%'}
          height={14}
        />
      ))}
    </div>
  );
}

/**
 * CardSkeleton - Loading state for content cards
 */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl p-5 ${tokens.bg.card} border ${tokens.border.subtle} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1">
          <Skeleton variant="text" width="60%" height={16} className="mb-2" />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>

      {/* Content lines */}
      <SkeletonGroup count={3} gap={8}>
        <Skeleton variant="text" width="100%" height={14} />
      </SkeletonGroup>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={80} height={24} />
      </div>
    </div>
  );
}

/**
 * ListItemSkeleton - Loading state for list items
 */
export function ListItemSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 p-4 ${className}`}>
      <Skeleton variant="circular" width={36} height={36} />
      <div className="flex-1">
        <Skeleton variant="text" width="70%" height={14} className="mb-2" />
        <Skeleton variant="text" width="40%" height={12} />
      </div>
      <Skeleton variant="rounded" width={60} height={28} />
    </div>
  );
}

/**
 * ChartSkeleton - Loading state for charts/visualizations
 */
export function ChartSkeleton({
  height = 200,
  className = '',
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${tokens.bg.card} border ${tokens.border.subtle} ${className}`}
    >
      {/* Chart header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" width={120} height={16} />
        <Skeleton variant="rounded" width={80} height={28} />
      </div>

      {/* Chart area */}
      <Skeleton variant="rectangular" width="100%" height={height} />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton variant="circular" width={8} height={8} />
            <Skeleton variant="text" width={60} height={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DashboardSkeleton - Full dashboard loading state
 */
export function DashboardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartSkeleton height={300} />
        </div>
        <div>
          <CardSkeleton />
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
        {/* Table header */}
        <div className="px-5 py-3 border-b border-white/5">
          <Skeleton variant="text" width={150} height={16} />
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRowSkeleton key={i} columns={5} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
