'use client';

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentSectionProps {
  title: string;
  count: number;
  defaultExpanded?: boolean;
  accentColor?: string;
  children: ReactNode;
  emptyMessage?: string;
}

export default function DocumentSection({
  title,
  count,
  defaultExpanded = true,
  accentColor,
  children,
  emptyMessage = 'No documents',
}: DocumentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-4">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-2 px-1 text-left hover:bg-white/5 rounded-lg transition-colors group"
      >
        {/* Expand/Collapse Icon */}
        <motion.svg
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-[#64748B]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </motion.svg>

        {/* Title */}
        <span
          className="text-sm font-medium"
          style={{ color: accentColor || '#64748B' }}
        >
          {title}
        </span>

        {/* Count Badge */}
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: accentColor ? `${accentColor}20` : 'rgba(255,255,255,0.1)',
            color: accentColor || '#8FA3BF',
          }}
        >
          {count}
        </span>
      </button>

      {/* Section Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {count > 0 ? (
              <div className="mt-2 bg-[#0B1220] border border-white/5 rounded-lg overflow-hidden">
                {children}
              </div>
            ) : (
              <div className="mt-2 py-6 text-center text-[#475569] text-sm">
                {emptyMessage}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
