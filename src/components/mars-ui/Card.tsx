'use client';

import { forwardRef, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { tokens, colors, shadows, animations } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export type CardVariant = 'default' | 'elevated' | 'bordered';
export type GlowColor = 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'orange';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  /** Card visual variant */
  variant?: CardVariant;
  /** Enable glow effect on hover */
  glow?: boolean;
  /** Glow color (requires glow=true) */
  glowColor?: GlowColor;
  /** Padding size */
  padding?: CardPadding;
  /** Interactive (adds hover lift animation) */
  interactive?: boolean;
  /** Whether card is currently active/selected */
  isActive?: boolean;
  /** Card content */
  children: ReactNode;
  /** Additional className */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GLOW_COLORS: Record<GlowColor, string> = {
  blue: colors.accent.blue,
  cyan: colors.accent.cyan,
  green: colors.accent.green,
  amber: colors.accent.amber,
  red: colors.accent.red,
  purple: colors.accent.purple,
  orange: colors.accent.orange,
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Card Component - Base container with variants
 *
 * Features:
 * - 3 variants: default, elevated, bordered
 * - Optional glow effect with custom colors
 * - Interactive mode with hover lift animation
 * - Active state styling
 *
 * @example
 * ```tsx
 * <Card variant="elevated" padding="md" interactive>
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      glow = false,
      glowColor = 'cyan',
      padding = 'md',
      interactive = false,
      isActive = false,
      children,
      className = '',
      ...motionProps
    },
    ref
  ) => {
    // Build variant classes
    const getVariantClasses = () => {
      switch (variant) {
        case 'elevated':
          return `${tokens.bg.elevated} border ${tokens.border.strong} ${tokens.shadow.elevated}`;
        case 'bordered':
          return `${tokens.bg.card} border-2 ${tokens.border.default}`;
        case 'default':
        default:
          return `${tokens.bg.card} border ${tokens.border.default} ${tokens.shadow.card}`;
      }
    };

    // Build active state classes
    const getActiveClasses = () => {
      if (!isActive) return '';
      const color = GLOW_COLORS[glowColor];
      return `border-[${color}]/35 ring-1 ring-[${color}]/20`;
    };

    // Build glow shadow for hover
    const getGlowStyle = () => {
      if (!glow) return {};
      const color = GLOW_COLORS[glowColor];
      return {
        '--glow-shadow': shadows.glow(color),
      } as React.CSSProperties;
    };

    // Interactive animations
    const interactiveProps = interactive
      ? {
          whileHover: {
            y: -2,
            boxShadow: glow ? shadows.glow(GLOW_COLORS[glowColor]) : shadows.elevated,
          },
          whileTap: { scale: 0.995 },
          transition: { duration: 0.15 },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        className={`
          ${tokens.radius.lg}
          ${getVariantClasses()}
          ${getActiveClasses()}
          ${PADDING_CLASSES[padding]}
          ${interactive ? 'cursor-pointer' : ''}
          transition-all duration-150
          ${className}
        `.trim()}
        style={getGlowStyle()}
        {...interactiveProps}
        {...motionProps}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

// =============================================================================
// CARD HEADER COMPONENT
// =============================================================================

export interface CardHeaderProps {
  /** Header title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional action element (button, icon, etc.) */
  action?: ReactNode;
  /** Additional className */
  className?: string;
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between ${className}`}>
      <div>
        <h3 className={`${tokens.text.primary} font-semibold`}>{title}</h3>
        {subtitle && (
          <p className={`${tokens.text.muted} text-sm mt-0.5`}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// =============================================================================
// CARD CONTENT COMPONENT
// =============================================================================

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`${tokens.text.secondary} ${className}`}>{children}</div>;
}

// =============================================================================
// CARD FOOTER COMPONENT
// =============================================================================

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
  /** Add top border */
  bordered?: boolean;
}

export function CardFooter({ children, className = '', bordered = false }: CardFooterProps) {
  return (
    <div
      className={`
        flex items-center gap-2
        ${bordered ? `border-t ${tokens.border.subtle} pt-4 mt-4` : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}

export default Card;
