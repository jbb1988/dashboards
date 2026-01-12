'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { CalendarEvent } from './types';

// Status colors matching Asana
const STATUS_COLORS = {
  confirmed: '#7FBA7A',
  placeholder: '#F1BD6C',
  default: '#64748B',
};

interface CalendarEventCardProps {
  event: CalendarEvent;
  isDragOverlay?: boolean;
  onClick?: () => void;
}

export function CalendarEventCard({ event, isDragOverlay, onClick }: CalendarEventCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: event.gid,
    data: { event },
  });

  const statusColor = event.status === 'confirmed'
    ? STATUS_COLORS.confirmed
    : event.status === 'placeholder'
      ? STATUS_COLORS.placeholder
      : STATUS_COLORS.default;

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  // Check if event is overdue
  const isOverdue = event.dueOn && new Date(event.dueOn) < new Date() && event.status !== 'confirmed';

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`
        group relative px-2 py-1.5 rounded cursor-grab active:cursor-grabbing
        transition-all duration-150 select-none
        ${isDragging ? 'opacity-40' : 'opacity-100'}
        ${isDragOverlay ? 'shadow-xl ring-2 ring-[#38BDF8]/50 rotate-2 scale-105' : ''}
        ${isOverdue ? 'ring-1 ring-[#EF4444]/50' : ''}
      `}
      style={{
        ...style,
        backgroundColor: statusColor,
      }}
      whileHover={!isDragging && !isDragOverlay ? { scale: 1.02, y: -1 } : {}}
      whileTap={{ scale: 0.98 }}
      initial={false}
    >
      {/* Event name */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-medium truncate leading-tight"
          style={{ color: '#1E293B' }}
        >
          {event.name}
        </span>
      </div>

      {/* Assignee indicator (subtle) */}
      {event.assignee && (
        <div
          className="text-[8px] truncate mt-0.5 opacity-70"
          style={{ color: '#1E293B' }}
        >
          {event.assignee.name}
        </div>
      )}

      {/* Drag handle indicator on hover */}
      {!isDragOverlay && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#1E293B' }}>
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
      )}

      {/* Overdue indicator */}
      {isOverdue && !isDragOverlay && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#EF4444] rounded-full animate-pulse" />
      )}
    </motion.div>
  );
}

// Static version for drag overlay
export function CalendarEventCardOverlay({ event }: { event: CalendarEvent }) {
  const statusColor = event.status === 'confirmed'
    ? STATUS_COLORS.confirmed
    : event.status === 'placeholder'
      ? STATUS_COLORS.placeholder
      : STATUS_COLORS.default;

  return (
    <div
      className="px-2 py-1.5 rounded shadow-xl ring-2 ring-[#38BDF8]/50 rotate-2 scale-105"
      style={{ backgroundColor: statusColor }}
    >
      <span
        className="text-[10px] font-medium truncate leading-tight block"
        style={{ color: '#1E293B' }}
      >
        {event.name}
      </span>
      {event.assignee && (
        <div
          className="text-[8px] truncate mt-0.5 opacity-70"
          style={{ color: '#1E293B' }}
        >
          {event.assignee.name}
        </div>
      )}
    </div>
  );
}
