'use client';

import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDay, CalendarEvent } from './types';
import { CalendarEventCard } from './CalendarEventCard';

interface CalendarDayCellProps {
  day: CalendarDay | null;
  onEventClick: (event: CalendarEvent) => void;
  singleDayEventsOnly?: boolean;
}

// Filter to get only single-day events
function getSingleDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(event => {
    const eventStart = event.startOn ? new Date(event.startOn) : null;
    const eventEnd = event.dueOn ? new Date(event.dueOn) : null;

    if (eventStart && eventEnd) {
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      const duration = Math.ceil((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return duration <= 1;
    }
    return true;
  });
}

export function CalendarDayCell({ day, onEventClick, singleDayEventsOnly = false }: CalendarDayCellProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: day?.dateKey ?? 'empty',
    disabled: !day,
  });

  // Empty cell (days outside the month)
  if (!day) {
    return (
      <div className="min-h-[90px] bg-[#0B1220]/60 border-r border-white/[0.02]" />
    );
  }

  // Filter events if singleDayEventsOnly is true
  const displayEvents = singleDayEventsOnly ? getSingleDayEvents(day.events) : day.events;

  const maxVisibleEvents = 3;
  const hasMoreEvents = displayEvents.length > maxVisibleEvents;
  const visibleEvents = displayEvents.slice(0, maxVisibleEvents);
  const hiddenCount = displayEvents.length - maxVisibleEvents;

  return (
    <motion.div
      ref={setNodeRef}
      id={day.isToday ? 'calendar-today' : undefined}
      className={`
        min-h-[90px] p-1.5 border-r border-white/[0.03] transition-colors duration-150
        ${day.isToday ? 'bg-[#E16259]/8 ring-1 ring-inset ring-[#E16259]/20' : ''}
        ${day.isPast && !day.isToday ? 'bg-[#0B1220]/40' : ''}
        ${!day.isPast && !day.isToday ? 'bg-[#151F2E]' : ''}
        ${isOver && active ? 'bg-[#38BDF8]/10 ring-2 ring-inset ring-[#38BDF8]/40' : ''}
      `}
      animate={{
        scale: isOver && active ? 1.01 : 1,
      }}
      transition={{ duration: 0.15 }}
    >
      {/* Day Header */}
      <div className={`
        flex items-center gap-1.5 mb-2
        ${day.isToday ? 'text-[#E16259]' : day.isPast ? 'text-[#475569]' : 'text-[#8FA3BF]'}
      `}>
        <span className={`
          text-[12px] font-semibold
          ${day.isToday ? 'bg-[#E16259] text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}
        `}>
          {day.date.getDate()}
        </span>
        {day.isToday && (
          <span className="text-[8px] uppercase font-bold tracking-wider">Today</span>
        )}
      </div>

      {/* Events */}
      <div className="space-y-1">
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
            className={`
              w-full text-[9px] py-1 rounded text-center
              ${day.isPast ? 'text-[#475569]' : 'text-[#64748B]'}
              hover:text-white hover:bg-white/5 transition-colors
            `}
            onClick={() => {
              // Could open a modal with all events for this day
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
            className="absolute inset-1 rounded border-2 border-dashed border-[#38BDF8]/50 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
