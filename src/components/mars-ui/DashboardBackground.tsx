'use client';

import { motion } from 'framer-motion';
import { colors } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface DashboardBackgroundProps {
  /** Primary accent color for the glow (defaults to cyan) */
  accentColor?: string;
  /** Secondary glow color (defaults to blue) */
  secondaryColor?: string;
  /** Show floating particles animation */
  showParticles?: boolean;
  /** Number of particles (default 15) */
  particleCount?: number;
  /** Grid line opacity (default 0.03) */
  gridOpacity?: number;
  /** Custom className for the container */
  className?: string;
}

// =============================================================================
// GRID BACKGROUND COMPONENT
// =============================================================================

/**
 * GridBackground - Animated grid with gradient overlay and radial glows
 *
 * This creates the premium A+ dashboard aesthetic with:
 * - Gradient overlay
 * - Subtle grid pattern
 * - Radial glow effects
 */
function GridBackground({
  accentColor = colors.accent.cyan,
  secondaryColor = colors.accent.blue,
  gridOpacity = 0.03,
}: {
  accentColor?: string;
  secondaryColor?: string;
  gridOpacity?: number;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1722] via-[#0F1722]/95 to-[#0F1722]" />

      {/* Animated grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, ${gridOpacity}) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, ${gridOpacity}) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Primary radial glow (top) */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[120px]"
        style={{ backgroundColor: `${secondaryColor}10` }}
      />

      {/* Secondary radial glow (bottom-left) */}
      <div
        className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full blur-[100px]"
        style={{ backgroundColor: `${accentColor}08` }}
      />

      {/* Tertiary glow (right side) */}
      <div
        className="absolute top-1/2 right-0 w-[300px] h-[500px] rounded-full blur-[100px]"
        style={{ backgroundColor: `${secondaryColor}05` }}
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
  color = colors.accent.cyan,
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
 * DashboardBackground - Premium animated background for dashboards
 *
 * Creates the A+ visual foundation with:
 * - Multi-layer gradient background
 * - Subtle animated grid
 * - Radial glow effects
 * - Optional floating particles
 *
 * @example
 * ```tsx
 * <div className="min-h-screen bg-[#0F1722] relative">
 *   <DashboardBackground accentColor="#38BDF8" showParticles />
 *   <div className="relative z-10">
 *     // Dashboard content here
 *   </div>
 * </div>
 * ```
 */
export function DashboardBackground({
  accentColor = colors.accent.cyan,
  secondaryColor = colors.accent.blue,
  showParticles = false,
  particleCount = 15,
  gridOpacity = 0.03,
  className = '',
}: DashboardBackgroundProps) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <GridBackground
        accentColor={accentColor}
        secondaryColor={secondaryColor}
        gridOpacity={gridOpacity}
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
 */
export const backgroundPresets = {
  /** Contracts - Blue/Cyan theme */
  contracts: {
    accentColor: colors.accent.cyan,
    secondaryColor: colors.accent.blue,
  },
  /** PM - Red/Orange warm theme */
  pm: {
    accentColor: '#E16259',
    secondaryColor: '#F97316',
  },
  /** Finance - Green theme */
  finance: {
    accentColor: colors.accent.green,
    secondaryColor: colors.accent.cyan,
  },
  /** Admin - Purple theme */
  admin: {
    accentColor: colors.accent.purple,
    secondaryColor: colors.accent.blue,
  },
  /** Guides - Cyan/Blue theme */
  guides: {
    accentColor: colors.accent.cyan,
    secondaryColor: colors.accent.purple,
  },
} as const;

export default DashboardBackground;
