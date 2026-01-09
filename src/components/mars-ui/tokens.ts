/**
 * MARS Design System - Unified Design Tokens
 *
 * Combined design language from Mind-Muscle Admin + MARS Pipeline
 * Key principles:
 * - 4-layer luminance model (neutral slate, not navy)
 * - Cards that float with real shadows
 * - Semantic color usage only
 * - Readable text at all levels
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

export const colors = {
  // BACKGROUNDS - 4 luminance layers
  bg: {
    app: '#0D0E12',        // Layer 1: Darkest - page background
    section: '#16181D',    // Layer 2: Section panels
    card: '#1E2028',       // Layer 3: Cards - visibly floats
    elevated: '#262932',   // Layer 4: Expanded/focus states
    hover: '#2E323D',      // Hover state
    input: '#121316',      // Input backgrounds (recessed)
  },

  // BORDERS - Structural, visible
  border: {
    subtle: '#2A2D37',     // Barely visible
    default: '#363A47',    // Standard borders
    strong: '#464B5A',     // Expanded/focus states
    focus: '#5B8DEF',      // Focus ring
  },

  // TEXT - Readable at all levels
  text: {
    primary: '#F0F2F5',    // Near white
    secondary: '#A8AEBB',  // Readable gray
    muted: '#7C8291',      // De-emphasized
    accent: '#5B8DEF',     // Links, actions
  },

  // ACCENT COLORS - Semantic meaning only
  accent: {
    blue: '#5B8DEF',       // Primary actions, info
    cyan: '#38BDF8',       // Analytics, stages
    green: '#30A46C',      // Success, complete
    amber: '#D4A72C',      // Warning, attention
    red: '#E5484D',        // Danger, overdue
    purple: '#8B5CF6',     // Analysis, special
    orange: '#F97316',     // Revenue, costs
  },
} as const;

// =============================================================================
// SHADOW TOKENS
// =============================================================================

export const shadows = {
  card: '0 2px 8px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.2)',
  elevated: '0 4px 16px rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.25)',
  inner: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  glow: (color: string) => `0 8px 32px ${color}40, 0 0 20px ${color}25`,
} as const;

// =============================================================================
// SPACING TOKENS
// =============================================================================

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

// =============================================================================
// RADIUS TOKENS
// =============================================================================

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

export const typography = {
  // Font sizes
  size: {
    h1: '28px',
    h2: '20px',
    h3: '16px',
    h4: '14px',
    body: '14px',
    bodySmall: '13px',
    label: '12px',
    caption: '11px',
    tiny: '10px',
  },
  // Font weights
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  // Letter spacing
  tracking: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',
  },
} as const;

// =============================================================================
// TAILWIND CLASS TOKENS (for direct use in className)
// =============================================================================

export const tokens = {
  // Background classes
  bg: {
    app: 'bg-[#0D0E12]',
    section: 'bg-[#16181D]',
    card: 'bg-[#1E2028]',
    elevated: 'bg-[#262932]',
    hover: 'bg-[#2E323D]',
    input: 'bg-[#121316]',
  },

  // Border classes
  border: {
    subtle: 'border-[#2A2D37]',
    default: 'border-[#363A47]',
    strong: 'border-[#464B5A]',
    focus: 'border-[#5B8DEF]',
  },

  // Text classes
  text: {
    primary: 'text-[#F0F2F5]',
    secondary: 'text-[#A8AEBB]',
    muted: 'text-[#7C8291]',
    accent: 'text-[#5B8DEF]',
  },

  // Shadow classes (inline style needed for complex shadows)
  shadow: {
    card: 'shadow-[0_2px_8px_rgba(0,0,0,0.35),0_0_1px_rgba(0,0,0,0.2)]',
    elevated: 'shadow-[0_4px_16px_rgba(0,0,0,0.45),0_0_1px_rgba(0,0,0,0.25)]',
    inner: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
  },

  // Radius classes
  radius: {
    sm: 'rounded-[6px]',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full',
    // Aliases for backwards compatibility
    card: 'rounded-xl',      // Same as lg
    control: 'rounded-lg',   // Same as md
    pill: 'rounded-full',    // Same as full
  },

  // Spacing classes
  spacing: {
    section: 'space-y-5',
    card: 'space-y-4',
  },

  // Status colors (for semantic use)
  status: {
    danger: {
      dot: 'bg-[#E5484D]',
      text: 'text-[#E5484D]',
      bg: 'bg-[#E5484D]/10',
      border: 'border-[#E5484D]/30',
    },
    warning: {
      dot: 'bg-[#D4A72C]',
      text: 'text-[#D4A72C]',
      bg: 'bg-[#D4A72C]/10',
      border: 'border-[#D4A72C]/30',
    },
    info: {
      dot: 'bg-[#5B8DEF]',
      text: 'text-[#5B8DEF]',
      bg: 'bg-[#5B8DEF]/10',
      border: 'border-[#5B8DEF]/30',
    },
    success: {
      dot: 'bg-[#30A46C]',
      text: 'text-[#30A46C]',
      bg: 'bg-[#30A46C]/10',
      border: 'border-[#30A46C]/30',
    },
    purple: {
      dot: 'bg-[#8B5CF6]',
      text: 'text-[#8B5CF6]',
      bg: 'bg-[#8B5CF6]/10',
      border: 'border-[#8B5CF6]/30',
    },
    cyan: {
      dot: 'bg-[#38BDF8]',
      text: 'text-[#38BDF8]',
      bg: 'bg-[#38BDF8]/10',
      border: 'border-[#38BDF8]/30',
    },
    orange: {
      dot: 'bg-[#F97316]',
      text: 'text-[#F97316]',
      bg: 'bg-[#F97316]/10',
      border: 'border-[#F97316]/30',
    },
  },
} as const;

// =============================================================================
// ANIMATION PRESETS (for Framer Motion)
// =============================================================================

export const animations = {
  // Entrance animation
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
  },

  // Staggered children
  staggerContainer: {
    animate: { transition: { staggerChildren: 0.05 } },
  },

  // Hover lift for cards
  hoverLift: {
    whileHover: { y: -2 },
    whileTap: { scale: 0.995 },
    transition: { duration: 0.15 },
  },

  // Expand/collapse
  expandCollapse: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.2 },
  },

  // Progress bar fill
  progressFill: (percent: number) => ({
    initial: { width: 0 },
    animate: { width: `${percent}%` },
    transition: { duration: 0.6, ease: 'easeOut' },
  }),

  // Pulsing animation
  pulse: {
    animate: { opacity: [1, 0.5, 1] },
    transition: { duration: 1.5, repeat: Infinity },
  },

  // Chevron rotation
  chevronRotate: (isOpen: boolean) => ({
    animate: { rotate: isOpen ? 90 : 0 },
    transition: { duration: 0.2 },
  }),
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get status color classes by status type
 */
export function getStatusClasses(status: 'danger' | 'warning' | 'info' | 'success' | 'purple' | 'cyan' | 'orange') {
  return tokens.status[status];
}

/**
 * Generate glow shadow for a given color
 */
export function getGlowShadow(color: string) {
  return `0 8px 32px ${color}40, 0 0 20px ${color}25`;
}

/**
 * Get accent color by name
 */
export function getAccentColor(name: keyof typeof colors.accent) {
  return colors.accent[name];
}
