'use client';

import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDay, CalendarEvent } from './types';
import { CalendarEventCard } from './CalendarEventCard';

interface CalendarDayCellProps {
  day: CalendarDay | null;
  onEventClick: (event: CalendarEvent) => void;
}

export function CalendarDayCell({ day, onEventClick }: CalendarDayCellProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: day?.dateKey ?? 'empty',
    disabled: !day,
  });

  // Empty cell (days outside the month)
  if (!day) {
    return (
      <div className="min-h-[120px] bg-[#0F172A]/80 border-r border-[#1E293B]" />
    );
  }

  const maxVisibleEvents = 3;
  const hasMoreEvents = day.events.length > maxVisibleEvents;
  const visibleEvents = day.events.slice(0, maxVisibleEvents);
  const hiddenCount = day.events.length - maxVisibleEvents;

  return (
    <motion.div
      ref={setNodeRef}
      id={day.isToday ? 'calendar-today' : undefined}
      className={`
        min-h-[120px] p-2 border-r border-[#1E293B] transition-all duration-150 relative
        ${day.isToday
          ? 'bg-[#E16259]/10 ring-2 ring-inset ring-[#E16259]'
          : day.isPast
            ? 'bg-[#0F172A]/60'
            : 'bg-[#0F172A] hover:bg-[#1E293B]/50'
        }
        ${isOver && active ? 'bg-[#38BDF8]/15 ring-2 ring-inset ring-[#38BDF8]' : ''}
      `}
      animate={{
        scale: isOver && active ? 1.02 : 1,
      }}
      transition={{ duration: 0.15 }}
    >
      {/* Day Number - Large and readable */}
      <div className="flex items-start justify-between mb-2">
        <div className={`
          flex items-center gap-2
          ${day.isToday ? 'text-[#E16259]' : day.isPast ? 'text-[#475569]' : 'text-[#E2E8F0]'}
        `}>
          <span className={`
            text-[16px] font-bold
            ${day.isToday
              ? 'bg-[#E16259] text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg'
              : ''
            }
          `}>
            {day.date.getDate()}
          </span>
          {day.isToday && (
            <span className="text-[9px] uppercase font-bold tracking-wider bg-[#E16259]/20 text-[#E16259] px-2 py-0.5 rounded">
              Today
            </span>
          )}
        </div>

        {/* Event count badge if there are events */}
        {day.events.length > 0 && !day.isToday && (
          <span className="text-[9px] text-[#64748B] bg-[#334155] px-1.5 py-0.5 rounded">
            {day.events.length}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {visibleEvents.map((event, index) => (
            <motion.div
              key={event.gid}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15, delay: index * 0.02 }}
            >
              <CalendarEventCard
                event={event}
                onClick={() => onEventClick(event)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* More events indicator */}
        {hasMoreEvents && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full text-[10px] py-1.5 rounded text-center font-medium
              text-[#94A3B8] bg-[#334155]/50 hover:bg-[#334155] hover:text-white
              transition-colors border border-[#334155]"
            onClick={() => {
              if (day.events.length > 0) {
                onEventClick(day.events[maxVisibleEvents]);
              }
            }}
          >
            +{hiddenCount} more
          </motion.button>
        )}
      </div>

      {/* Drop indicator overlay */}
      <AnimatePresence>
        {isOver && active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-1 rounded-lg border-2 border-dashed border-[#38BDF8] pointer-events-none bg-[#38BDF8]/5"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
