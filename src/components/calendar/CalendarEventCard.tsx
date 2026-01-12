'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { CalendarEvent } from './types';

// Status colors
const STATUS_COLORS = {
  confirmed: { bg: '#22C55E', border: '#16A34A', text: '#FFFFFF' },
  placeholder: { bg: '#F59E0B', border: '#D97706', text: '#FFFFFF' },
  default: { bg: '#6366F1', border: '#4F46E5', text: '#FFFFFF' },
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

  const colors = event.status === 'confirmed'
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
        group relative px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing
        transition-all duration-150 select-none
        border-l-4 shadow-sm hover:shadow-md
        ${isDragging ? 'opacity-40' : 'opacity-100'}
        ${isDragOverlay ? 'shadow-2xl ring-2 ring-white/20 rotate-1 scale-105' : ''}
        ${isOverdue ? 'ring-1 ring-red-500/50' : ''}
      `}
      style={{
        ...style,
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
      }}
      whileHover={!isDragging && !isDragOverlay ? { scale: 1.02, y: -1 } : {}}
      whileTap={{ scale: 0.98 }}
      initial={false}
    >
      {/* Event name */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[11px] font-semibold truncate leading-tight"
          style={{ color: colors.text }}
        >
          {event.name}
        </span>
      </div>

      {/* Assignee */}
      {event.assignee && (
        <div
          className="text-[9px] truncate mt-0.5 opacity-80"
          style={{ color: colors.text }}
        >
          {event.assignee.name}
        </div>
      )}

      {/* Drag handle indicator on hover */}
      {!isDragOverlay && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" style={{ color: colors.text }}>
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
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg" />
      )}
    </motion.div>
  );
}

// Static version for drag overlay
export function CalendarEventCardOverlay({ event }: { event: CalendarEvent }) {
  const colors = event.status === 'confirmed'
    ? STATUS_COLORS.confirmed
    : event.status === 'placeholder'
      ? STATUS_COLORS.placeholder
      : STATUS_COLORS.default;

  return (
    <div
      className="px-2.5 py-2 rounded-lg shadow-2xl ring-2 ring-white/30 rotate-2 scale-105 border-l-4"
      style={{
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
      }}
    >
      <span
        className="text-[11px] font-semibold truncate leading-tight block"
        style={{ color: colors.text }}
      >
        {event.name}
      </span>
      {event.assignee && (
        <div
          className="text-[9px] truncate mt-0.5 opacity-80"
          style={{ color: colors.text }}
        >
          {event.assignee.name}
        </div>
      )}
    </div>
  );
}
