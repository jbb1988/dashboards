/**
 * MARS Design System - Apple Pro Dark UI Tokens
 *
 * 3-Level Elevation System:
 * - L0: Base canvas with luminous radial gradient
 * - L1: Content surfaces (cards, tables, panels)
 * - L2: Active/focus surfaces (toolbars, modals, popovers)
 *
 * Key Principles:
 * - No flat black backgrounds
 * - Every elevated surface has inner highlight
 * - Ambient shadows (30px 90px), no sharp shadows
 * - Color accents appear within 3 seconds of use
 * - Document visually "floats" off the page
 * - UI reads as luminous, not matte
 */

// =============================================================================
// APPLE PRO ELEVATION TOKENS
// =============================================================================

export const elevation = {
  // L0 - Base Canvas: Luminous radial gradient
  L0: {
    background: 'radial-gradient(1200px 800px at 50% -20%, rgba(90,130,255,0.22), rgba(10,14,20,0.98) 60%)',
    // Alternative with noise texture (optional)
    backgroundNoise: `
      radial-gradient(1200px 800px at 50% -20%, rgba(90,130,255,0.22), rgba(10,14,20,0.98) 60%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")
    `,
  },

  // L1 - Content Surface: Cards, tables, panels
  L1: {
    background: 'linear-gradient(180deg, rgba(28,36,52,0.88), rgba(18,24,36,0.96))',
    shadow: '0 30px 90px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)',
    halo: 'drop-shadow(0 0 120px rgba(90,130,255,0.15))',
    radius: '16px',
  },

  // L2 - Active/Focus Surface: Toolbars, modals, popovers
  L2: {
    background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
    shadow: '0 30px 90px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.10)',
    radius: '18px',
  },

  // Hover state for L1 rows
  hoverRow: 'rgba(255,255,255,0.06)',
} as const;

// =============================================================================
// COLOR TOKENS - Apple Pro Accents
// =============================================================================

export const colors = {
  // BACKGROUNDS - Deprecated flat colors, use elevation instead
  bg: {
    app: '#0D0E12',        // Fallback only - prefer elevation.L0
    section: '#16181D',    // Deprecated - use elevation.L1
    card: '#1E2028',       // Deprecated - use elevation.L1
    elevated: '#262932',   // Deprecated - use elevation.L2
    hover: '#2E323D',      // Deprecated - use elevation.hoverRow
    input: '#121316',      // Input backgrounds (recessed)
  },

  // BORDERS - Minimal use, prefer borderless with shadows
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    default: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.12)',
    focus: 'rgba(90,130,255,0.95)',
  },

  // TEXT - Apple Pro off-white hierarchy
  text: {
    primary: '#EBF0FFE8',    // Main text (92% opacity)
    secondary: '#C8D2EBBF',  // Section headers (75% opacity)
    muted: '#C8D2EB80',      // De-emphasized (50% opacity)
    accent: '#5A82FF',       // Links, active states
  },

  // ACCENT COLORS - Required, not optional
  // All colors in hex format to support opacity suffix (e.g. ${color}30)
  accent: {
    blue: '#5A82FF',                       // Primary actions, active state, focus glow
    cyan: '#38BDF8',                       // Analytics, stages
    green: '#50D28C',                      // Success, complete
    amber: '#FFBE5A',                      // Warning, attention
    red: '#FF5F5F',                        // Danger, errors
    purple: '#8B5CF6',                     // Analysis, special
    orange: '#F97316',                     // Revenue, costs
  },

  // Glow variants for accents (hex with alpha)
  glow: {
    blue: '#5A82FF40',
    green: '#50D28C40',
    amber: '#FFBE5A40',
    red: '#FF5F5F40',
  },
} as const;

// =============================================================================
// SHADOW TOKENS - Apple Pro depth system
// =============================================================================

export const shadows = {
  // L1 ambient shadow (no sharp shadows)
  L1: '0 30px 90px rgba(0,0,0,0.75)',
  // L2 ambient shadow
  L2: '0 30px 90px rgba(0,0,0,0.75)',
  // Inner highlight (mandatory on all elevated surfaces)
  innerHighlight: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  innerHighlightStrong: 'inset 0 1px 0 rgba(255,255,255,0.10)',
  // Document halo
  halo: 'drop-shadow(0 0 120px rgba(90,130,255,0.15))',
  // Legacy
  card: '0 30px 90px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)',
  elevated: '0 30px 90px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.10)',
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
// RADIUS TOKENS - Apple Pro larger radii
// =============================================================================

export const radius = {
  sm: '10px',
  md: '12px',
  lg: '16px',
  xl: '18px',
  xxl: '20px',
  full: '9999px',
} as const;

// =============================================================================
// TYPOGRAPHY TOKENS - Apple Pro heavier weight
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
  // Font weights - heavier for Apple Pro
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  // Letter spacing
  tracking: {
    tight: '-0.02em',
    normal: '-0.01em',
    wide: '0.02em',
    wider: '0.05em',
  },
} as const;

// =============================================================================
// TAILWIND CLASS TOKENS (for direct use in className)
// =============================================================================

export const tokens = {
  // Background classes - use elevation system instead
  bg: {
    app: 'bg-[#0D0E12]',      // Fallback
    section: 'bg-[#16181D]',  // Deprecated
    card: 'bg-[#1E2028]',     // Deprecated
    elevated: 'bg-[#262932]', // Deprecated
    hover: 'bg-[#2E323D]',    // Deprecated
    input: 'bg-[#121316]',
  },

  // Border classes - minimal use
  border: {
    subtle: 'border-[rgba(255,255,255,0.06)]',
    default: 'border-[rgba(255,255,255,0.08)]',
    strong: 'border-[rgba(255,255,255,0.12)]',
    focus: 'border-[rgba(90,130,255,0.95)]',
  },

  // Text classes - Apple Pro off-white
  text: {
    primary: 'text-[rgba(235,240,255,0.92)]',
    secondary: 'text-[rgba(200,210,235,0.75)]',
    muted: 'text-[rgba(200,210,235,0.50)]',
    accent: 'text-[rgba(90,130,255,0.95)]',
  },

  // Shadow classes
  shadow: {
    card: 'shadow-[0_30px_90px_rgba(0,0,0,0.75)]',
    elevated: 'shadow-[0_30px_90px_rgba(0,0,0,0.75)]',
    inner: 'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
  },

  // Radius classes - Apple Pro larger
  radius: {
    sm: 'rounded-[10px]',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-[18px]',
    full: 'rounded-full',
    // Aliases
    card: 'rounded-2xl',
    control: 'rounded-xl',
    pill: 'rounded-full',
  },

  // Spacing classes
  spacing: {
    section: 'space-y-5',
    card: 'space-y-4',
  },

  // Status colors - Apple Pro accents
  status: {
    danger: {
      dot: 'bg-[rgba(255,95,95,0.95)]',
      text: 'text-[rgba(255,95,95,0.95)]',
      bg: 'bg-[rgba(255,95,95,0.08)]',
      border: 'border-[rgba(255,95,95,0.20)]',
    },
    warning: {
      dot: 'bg-[rgba(255,190,90,0.95)]',
      text: 'text-[rgba(255,190,90,0.95)]',
      bg: 'bg-[rgba(255,190,90,0.08)]',
      border: 'border-[rgba(255,190,90,0.20)]',
    },
    info: {
      dot: 'bg-[rgba(90,130,255,0.95)]',
      text: 'text-[rgba(90,130,255,0.95)]',
      bg: 'bg-[rgba(90,130,255,0.08)]',
      border: 'border-[rgba(90,130,255,0.20)]',
    },
    success: {
      dot: 'bg-[rgba(80,210,140,0.95)]',
      text: 'text-[rgba(80,210,140,0.95)]',
      bg: 'bg-[rgba(80,210,140,0.08)]',
      border: 'border-[rgba(80,210,140,0.20)]',
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

/**
 * Get elevation styles for a surface level
 */
export function getElevationStyle(level: 'L0' | 'L1' | 'L2') {
  const el = elevation[level];
  return {
    background: el.background,
    boxShadow: 'shadow' in el ? el.shadow : undefined,
    borderRadius: 'radius' in el ? el.radius : undefined,
  };
}
