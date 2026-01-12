'use client';

import { motion } from 'framer-motion';
import { SpanningEvent, CalendarEvent } from './types';

// Status colors matching CalendarEventCard
const STATUS_COLORS = {
  confirmed: { bg: '#22C55E', border: '#16A34A', text: '#FFFFFF' },
  placeholder: { bg: '#F59E0B', border: '#D97706', text: '#FFFFFF' },
  default: { bg: '#6366F1', border: '#4F46E5', text: '#FFFFFF' },
};

interface CalendarSpanningEventProps {
  spanning: SpanningEvent;
  onClick: (event: CalendarEvent) => void;
}

export function CalendarSpanningEvent({ spanning, onClick }: CalendarSpanningEventProps) {
  const { event, startCol, endCol, isStart, isEnd, row } = spanning;

  const colors = event.status === 'confirmed'
    ? STATUS_COLORS.confirmed
    : event.status === 'placeholder'
      ? STATUS_COLORS.placeholder
      : STATUS_COLORS.default;

  // Calculate width as percentage (each column is ~14.28%)
  const colWidth = 100 / 7;
  const left = startCol * colWidth;
  const width = (endCol - startCol + 1) * colWidth;

  // Each row is 24px height + 4px gap
  const top = row * 28 + 4;

  return (
    <motion.div
      className={`
        absolute h-[22px] cursor-pointer z-10
        flex items-center px-2 text-[11px] font-semibold
        shadow-sm hover:shadow-md transition-shadow
        ${isStart ? 'rounded-l-md' : ''}
        ${isEnd ? 'rounded-r-md' : ''}
        ${!isStart && !isEnd ? '' : ''}
      `}
      style={{
        left: `calc(${left}% + ${isStart ? 4 : 0}px)`,
        width: `calc(${width}% - ${(isStart ? 4 : 0) + (isEnd ? 4 : 0)}px)`,
        top: `${top}px`,
        backgroundColor: colors.bg,
        borderLeft: isStart ? `3px solid ${colors.border}` : 'none',
        color: colors.text,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99 }}
    >
      <span className="truncate">
        {event.name}
      </span>
      {event.assignee && (
        <span className="ml-2 opacity-70 truncate hidden sm:inline">
          — {event.assignee.name}
        </span>
      )}
    </motion.div>
  );
}
