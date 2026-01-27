/**
 * MARS Design System - Apple Pro Dark UI
 *
 * 3-Level Elevation System:
 * - L0: Base canvas with luminous radial gradient
 * - L1: Content surfaces (cards, tables, panels)
 * - L2: Active/focus surfaces (toolbars, modals, popovers)
 *
 * Usage:
 * ```tsx
 * import { elevation, colors, KPICard, DashboardBackground } from '@/components/mars-ui';
 * ```
 */

// =============================================================================
// DESIGN TOKENS - Apple Pro Elevation System
// =============================================================================

export {
  elevation,
  colors,
  shadows,
  spacing,
  radius,
  typography,
  tokens,
  animations,
  getStatusClasses,
  getGlowShadow,
  getAccentColor,
  getElevationStyle,
} from './tokens';

// =============================================================================
// CARD COMPONENTS
// =============================================================================

export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  type CardProps,
  type CardVariant,
  type GlowColor,
  type CardPadding,
  type CardHeaderProps,
  type CardContentProps,
  type CardFooterProps,
} from './Card';

// =============================================================================
// KPI CARD COMPONENTS
// =============================================================================

export {
  KPICard,
  AnimatedCounter,
  KPIIcons,
  type KPICardProps,
  type TrendDirection,
} from './KPICard';

// =============================================================================
// BADGE COMPONENTS
// =============================================================================

export {
  Badge,
  StatusDot,
  CountBadge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeColor,
  type BadgeSize,
  type StatusDotProps,
  type CountBadgeProps,
} from './Badge';

// =============================================================================
// EXPANDABLE COMPONENTS
// =============================================================================

export {
  ExpandableRow,
  ExpandableSection,
  type ExpandableRowProps,
  type ExpandableSectionProps,
} from './ExpandableRow';

// =============================================================================
// PROGRESS COMPONENTS
// =============================================================================

export {
  ProgressBar,
  DistributionBar,
  UrgencyBar,
  type ProgressBarProps,
  type ProgressSize,
  type ProgressColor,
  type DistributionBarProps,
  type DistributionSegment,
  type UrgencyBarProps,
} from './ProgressBar';

// =============================================================================
// DASHBOARD BACKGROUND COMPONENTS
// =============================================================================

export {
  DashboardBackground,
  backgroundPresets,
  type DashboardBackgroundProps,
} from './DashboardBackground';

// =============================================================================
// SKELETON LOADING COMPONENTS
// =============================================================================

export {
  Skeleton,
  SkeletonGroup,
  KPICardSkeleton,
  TableRowSkeleton,
  CardSkeleton,
  ListItemSkeleton,
  ChartSkeleton,
  DashboardSkeleton,
  type SkeletonProps,
  type SkeletonVariant,
  type SkeletonGroupProps,
} from './Skeleton';

// =============================================================================
// DATA SOURCE INDICATOR COMPONENTS
// =============================================================================

export {
  DataSourceIndicator,
  type DataSourceIndicatorProps,
  type DataSourceType,
} from './DataSourceIndicator';
