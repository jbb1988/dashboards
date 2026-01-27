'use client';

import { motion } from 'framer-motion';
import { elevation, colors } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface DashboardBackgroundProps {
  /** Primary accent color for the glow (defaults to blue) */
  accentColor?: string;
  /** Secondary glow color (defaults to blue) */
  secondaryColor?: string;
  /** Show floating particles animation */
  showParticles?: boolean;
  /** Number of particles (default 15) */
  particleCount?: number;
  /** Use noise texture overlay (default false) */
  useNoise?: boolean;
  /** Custom className for the container */
  className?: string;
}

// =============================================================================
// APPLE PRO L0 CANVAS COMPONENT
// =============================================================================

/**
 * AppleProCanvas - Luminous radial gradient background
 *
 * Creates the Apple Pro L0 base canvas with:
 * - Radial gradient with blue luminosity
 * - Optional noise texture
 * - No grid lines (deleted per spec)
 */
function AppleProCanvas({
  accentColor = colors.accent.blue,
  useNoise = false,
}: {
  accentColor?: string;
  useNoise?: boolean;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* L0 - Base Canvas: Luminous radial gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: useNoise ? elevation.L0.backgroundNoise : elevation.L0.background,
        }}
      />

      {/* Primary radial glow (top-center) - enhanced luminosity */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[1200px] h-[800px] rounded-full blur-[150px]"
        style={{ backgroundColor: `${accentColor}15` }}
      />

      {/* Secondary ambient glow (bottom-left) */}
      <div
        className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px]"
        style={{ backgroundColor: `${accentColor}08` }}
      />

      {/* Tertiary glow (right side) */}
      <div
        className="absolute top-1/3 right-0 w-[400px] h-[600px] rounded-full blur-[120px]"
        style={{ backgroundColor: `${accentColor}06` }}
      />
    </div>
  );
}

// =============================================================================
// FLOATING PARTICLES COMPONENT
// =============================================================================

/**
 * FloatingParticles - Subtle animated particles for ambient motion
 */
function FloatingParticles({
  count = 15,
  color = colors.accent.blue,
}: {
  count?: number;
  color?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ backgroundColor: `${color}30` }}
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            y: [null, -20, 20],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * DashboardBackground - Apple Pro L0 Canvas
 *
 * Creates the luminous foundation with:
 * - Radial gradient (1200px 800px) with blue luminosity
 * - Multiple ambient glow layers
 * - Optional floating particles
 * - Optional noise texture
 *
 * @example
 * ```tsx
 * <div className="min-h-screen relative">
 *   <DashboardBackground />
 *   <div className="relative z-10">
 *     // Dashboard content here
 *   </div>
 * </div>
 * ```
 */
export function DashboardBackground({
  accentColor = colors.accent.blue,
  secondaryColor = colors.accent.blue,
  showParticles = false,
  particleCount = 15,
  useNoise = false,
  className = '',
}: DashboardBackgroundProps) {
  return (
    <div className={`fixed inset-0 pointer-events-none z-0 ${className}`}>
      <AppleProCanvas
        accentColor={accentColor}
        useNoise={useNoise}
      />
      {showParticles && (
        <FloatingParticles
          count={particleCount}
          color={accentColor}
        />
      )}
    </div>
  );
}

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

/**
 * Pre-configured background variants for different dashboard types
 * All use Apple Pro blue luminosity base with accent variations
 */
export const backgroundPresets = {
  /** Default - Blue luminosity */
  default: {
    accentColor: colors.accent.blue,
    secondaryColor: colors.accent.blue,
  },
  /** Contracts - Blue luminosity */
  contracts: {
    accentColor: colors.accent.blue,
    secondaryColor: colors.accent.blue,
  },
  /** PM - Amber accent */
  pm: {
    accentColor: colors.accent.amber,
    secondaryColor: colors.accent.blue,
  },
  /** Finance - Green accent */
  finance: {
    accentColor: colors.accent.green,
    secondaryColor: colors.accent.blue,
  },
  /** Admin - Purple accent */
  admin: {
    accentColor: colors.accent.purple,
    secondaryColor: colors.accent.blue,
  },
  /** Guides - Blue luminosity */
  guides: {
    accentColor: colors.accent.blue,
    secondaryColor: colors.accent.blue,
  },
} as const;

export default DashboardBackground;
