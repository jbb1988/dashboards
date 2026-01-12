'use client';

import { useMemo } from 'react';
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

  // Count unique events in month
  const eventCount = useMemo(() => {
    const seenIds = new Set<string>();
    month.weeks.forEach(week => {
      week.days.forEach(day => {
        if (day) {
          day.events.forEach(event => {
            seenIds.add(event.gid);
          });
        }
      });
    });
    return seenIds.size;
  }, [month]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Month Header - Strong visual separation */}
      <div className={`
        sticky top-0 z-10 px-5 py-4
        bg-[#1E293B] border-b-2
        flex items-center justify-between
        ${isCurrentMonth ? 'border-[#E16259]' : 'border-[#334155]'}
      `}>
        <div className="flex items-center gap-3">
          <span className={`
            text-[18px] font-bold tracking-tight
            ${isCurrentMonth ? 'text-[#E16259]' : 'text-white'}
          `}>
            {monthName}
          </span>
          {isCurrentMonth && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#E16259] text-white font-semibold uppercase tracking-wider">
              Current Month
            </span>
          )}
        </div>

        <span className="text-[12px] text-[#64748B] bg-[#334155]/50 px-3 py-1 rounded">
          {eventCount} events
        </span>
      </div>

      {/* Weeks */}
      <div>
        {month.weeks.map((week, weekIdx) => (
          <div
            key={weekIdx}
            className="grid grid-cols-7 border-b border-[#1E293B]"
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
