'use client';

import { motion } from 'framer-motion';
import { CalendarMonth as CalendarMonthType, CalendarEvent } from './types';
import { CalendarDayCell } from './CalendarDayCell';

interface CalendarMonthProps {
  month: CalendarMonthType;
  onEventClick: (event: CalendarEvent) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function CalendarMonth({ month, onEventClick }: CalendarMonthProps) {
  const monthName = `${MONTH_NAMES[month.month]} ${month.year}`;

  // Check if this month contains today
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === month.year && today.getMonth() === month.month;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="border-b border-white/[0.04]"
    >
      {/* Month Header - Sticky */}
      <div className={`
        sticky top-[41px] z-10 px-4 py-2.5
        bg-[#0F1722]/95 backdrop-blur-sm
        border-b border-white/[0.06]
        flex items-center justify-between
      `}>
        <div className="flex items-center gap-2">
          <span className={`
            text-[13px] font-semibold
            ${isCurrentMonth ? 'text-[#E16259]' : 'text-[#EAF2FF]'}
          `}>
            {monthName}
          </span>
          {isCurrentMonth && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E16259]/20 text-[#E16259] font-medium">
              Current
            </span>
          )}
        </div>

        {/* Month event count */}
        <span className="text-[10px] text-[#64748B]">
          {month.weeks.reduce((sum, week) =>
            sum + week.days.reduce((daySum, day) =>
              daySum + (day?.events.length || 0), 0
            ), 0
          )} events
        </span>
      </div>

      {/* Weeks */}
      <div>
        {month.weeks.map((week, weekIdx) => (
          <div
            key={weekIdx}
            className="grid grid-cols-7 border-b border-white/[0.02]"
          >
            {week.days.map((day, dayIdx) => (
              <CalendarDayCell
                key={day?.dateKey ?? `empty-${month.year}-${month.month}-${weekIdx}-${dayIdx}`}
                day={day}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
