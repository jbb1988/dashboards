/**
 * MARS Design System - Component Library
 *
 * A unified design system combining patterns from:
 * - Mind-Muscle Admin (component structure, card variants)
 * - MARS Pipeline (KPI cards, stage colors, animations)
 *
 * Usage:
 * ```tsx
 * import { Card, KPICard, Badge, ProgressBar } from '@/components/mars-ui';
 * ```
 */

// =============================================================================
// DESIGN TOKENS
// =============================================================================

export {
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
