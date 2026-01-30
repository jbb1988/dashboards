'use client';

import { motion } from 'framer-motion';
import { Inbox, Archive } from 'lucide-react';

interface ViewSwitcherProps {
  activeView: 'inbox' | 'archive';
  inboxCount: number;
  archiveCount: number;
  onViewChange: (view: 'inbox' | 'archive') => void;
}

export default function ViewSwitcher({
  activeView,
  inboxCount,
  archiveCount,
  onViewChange,
}: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[rgba(10,14,20,0.60)] rounded-xl border border-[rgba(255,255,255,0.06)]">
      {/* Inbox Button */}
      <button
        onClick={() => onViewChange('inbox')}
        className={`
          relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
          text-[12px] font-semibold transition-all duration-[180ms]
          ${activeView === 'inbox'
            ? 'text-[rgba(235,240,255,0.95)]'
            : 'text-[rgba(200,210,235,0.50)] hover:text-[rgba(235,240,255,0.92)]'
          }
        `}
      >
        {activeView === 'inbox' && (
          <motion.div
            layoutId="activeViewBg"
            className="absolute inset-0 rounded-lg"
            style={{
              background: 'linear-gradient(180deg, rgba(90,130,255,0.25), rgba(90,130,255,0.15))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 8px rgba(90,130,255,0.20)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Inbox className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Inbox</span>
        {inboxCount > 0 && (
          <span
            className={`
              relative z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full
              ${activeView === 'inbox'
                ? 'bg-[rgba(255,190,90,0.25)] text-[rgba(255,190,90,0.95)]'
                : 'bg-[rgba(255,190,90,0.15)] text-[rgba(255,190,90,0.75)]'
              }
            `}
          >
            {inboxCount > 99 ? '99+' : inboxCount}
          </span>
        )}
      </button>

      {/* Archive Button */}
      <button
        onClick={() => onViewChange('archive')}
        className={`
          relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
          text-[12px] font-semibold transition-all duration-[180ms]
          ${activeView === 'archive'
            ? 'text-[rgba(235,240,255,0.95)]'
            : 'text-[rgba(200,210,235,0.50)] hover:text-[rgba(235,240,255,0.92)]'
          }
        `}
      >
        {activeView === 'archive' && (
          <motion.div
            layoutId="activeViewBg"
            className="absolute inset-0 rounded-lg"
            style={{
              background: 'linear-gradient(180deg, rgba(90,130,255,0.25), rgba(90,130,255,0.15))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 8px rgba(90,130,255,0.20)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <Archive className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Archive</span>
        <span
          className={`
            relative z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full
            ${activeView === 'archive'
              ? 'bg-[rgba(200,210,235,0.25)] text-[rgba(200,210,235,0.95)]'
              : 'bg-[rgba(200,210,235,0.15)] text-[rgba(200,210,235,0.50)]'
            }
          `}
        >
          {archiveCount > 999 ? '999+' : archiveCount}
        </span>
      </button>
    </div>
  );
}
