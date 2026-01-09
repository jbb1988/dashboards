'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens, animations } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface ExpandableRowProps {
  /** Header content (always visible) */
  header: ReactNode;
  /** Expanded content */
  children: ReactNode;
  /** Whether row is expanded */
  isExpanded: boolean;
  /** Toggle handler */
  onToggle: () => void;
  /** Optional accent color for expanded state */
  accentColor?: string;
  /** Show chevron indicator */
  showChevron?: boolean;
  /** Additional className for container */
  className?: string;
  /** Additional className for header */
  headerClassName?: string;
  /** Additional className for content */
  contentClassName?: string;
  /** Border between items in a list */
  bordered?: boolean;
}

// =============================================================================
// CHEVRON ICON
// =============================================================================

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <motion.svg
      animate={{ rotate: isExpanded ? 90 : 0 }}
      transition={{ duration: 0.2 }}
      className={`w-4 h-4 ${tokens.text.muted}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </motion.svg>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ExpandableRow Component - Expandable list item with animation
 *
 * Features:
 * - Smooth height animation using Framer Motion
 * - Chevron rotation indicator
 * - Elevated background when expanded
 * - Inner shadow for depth
 * - Optional accent color border
 *
 * @example
 * ```tsx
 * <ExpandableRow
 *   header={<ContractHeader contract={contract} />}
 *   isExpanded={expanded}
 *   onToggle={() => setExpanded(!expanded)}
 * >
 *   <ContractDetails contract={contract} />
 * </ExpandableRow>
 * ```
 */
export function ExpandableRow({
  header,
  children,
  isExpanded,
  onToggle,
  accentColor,
  showChevron = true,
  className = '',
  headerClassName = '',
  contentClassName = '',
  bordered = true,
}: ExpandableRowProps) {
  return (
    <div
      className={`
        ${bordered ? `border-b ${tokens.border.subtle} last:border-0` : ''}
        ${isExpanded ? tokens.bg.elevated : ''}
        transition-colors duration-150
        ${className}
      `.trim()}
    >
      {/* Header - clickable */}
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-3 py-3 px-4 text-left
          hover:${tokens.bg.hover}
          transition-colors duration-150
          ${headerClassName}
        `.trim()}
      >
        {showChevron && <ChevronIcon isExpanded={isExpanded} />}
        <div className="flex-1 min-w-0">{header}</div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={`
                px-4 py-4 pl-11
                ${tokens.bg.elevated}
                border-t ${tokens.border.default}
                ${tokens.shadow.inner}
                ${accentColor ? `border-l-2` : ''}
                ${contentClassName}
              `.trim()}
              style={accentColor ? { borderLeftColor: accentColor } : undefined}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// EXPANDABLE SECTION COMPONENT
// =============================================================================

export interface ExpandableSectionProps {
  /** Section title */
  title: string;
  /** Item count badge */
  count?: number;
  /** Whether section is expanded */
  isExpanded: boolean;
  /** Toggle handler */
  onToggle: () => void;
  /** Section content */
  children: ReactNode;
  /** Accent color for title */
  accentColor?: string;
  /** Additional className */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * ExpandableSection - Collapsible section with title and count
 *
 * @example
 * ```tsx
 * <ExpandableSection
 *   title="Needs Attention"
 *   count={3}
 *   isExpanded={expanded}
 *   onToggle={toggle}
 * >
 *   {items.map(item => <ItemRow key={item.id} />)}
 * </ExpandableSection>
 * ```
 */
export function ExpandableSection({
  title,
  count,
  isExpanded,
  onToggle,
  children,
  accentColor,
  className = '',
  emptyMessage,
}: ExpandableSectionProps) {
  const isEmpty = count === 0;

  return (
    <div
      className={`
        ${tokens.bg.card}
        ${tokens.radius.lg}
        border ${tokens.border.default}
        ${tokens.shadow.card}
        overflow-hidden
        ${className}
      `.trim()}
    >
      {/* Section header */}
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center justify-between p-4
          hover:${tokens.bg.hover}
          transition-colors duration-150
        `}
      >
        <div className="flex items-center gap-3">
          <motion.svg
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className={tokens.text.muted}
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </motion.svg>
          <span
            className={`font-semibold ${tokens.text.primary}`}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {title}
          </span>
        </div>

        {count !== undefined && (
          <span
            className={`
              px-2 py-0.5 rounded-full text-xs font-medium
              ${isEmpty ? `${tokens.bg.section} ${tokens.text.muted}` : `bg-white/10 ${tokens.text.secondary}`}
            `}
          >
            {count}
          </span>
        )}
      </button>

      {/* Section content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`border-t ${tokens.border.subtle}`}>
              {isEmpty && emptyMessage ? (
                <div className={`p-6 text-center ${tokens.text.muted} text-sm`}>
                  {emptyMessage}
                </div>
              ) : (
                children
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExpandableRow;
