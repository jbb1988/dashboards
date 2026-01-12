'use client';

import { motion } from 'framer-motion';

export function CalendarSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Month header skeleton */}
      <div className="sticky top-[41px] z-10 px-4 py-2 bg-[#0F1722]/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="h-4 w-28 bg-white/10 rounded" />
      </div>

      {/* Week rows skeleton */}
      {[1, 2, 3, 4].map((week) => (
        <div key={week} className="grid grid-cols-7 border-b border-white/[0.03]">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <div
              key={day}
              className="min-h-[120px] p-2 border-r border-white/[0.03] bg-[#151F2E]"
            >
              {/* Day number skeleton */}
              <div className="h-5 w-5 bg-white/10 rounded mb-3" />

              {/* Event card skeletons */}
              <div className="space-y-1.5">
                <motion.div
                  className="h-6 bg-white/5 rounded"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: day * 0.1 }}
                />
                {day % 3 === 0 && (
                  <motion.div
                    className="h-6 bg-white/5 rounded w-4/5"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: day * 0.1 + 0.2 }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CalendarLoadingIndicator({ direction }: { direction: 'past' | 'future' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center py-4"
    >
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0F1722] border border-white/[0.06]">
        <motion.div
          className="w-4 h-4 border-2 border-[#E16259]/30 border-t-[#E16259] rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <span className="text-[11px] text-[#8FA3BF]">
          Loading {direction === 'past' ? 'earlier' : 'later'} months...
        </span>
      </div>
    </motion.div>
  );
}
