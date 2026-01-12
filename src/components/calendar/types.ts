// Calendar component type definitions

export interface CalendarEvent {
  gid: string;
  name: string;
  startOn: string | null;
  dueOn: string | null;
  assignee: { name: string; email?: string } | null;
  status: 'confirmed' | 'placeholder' | null;
  tags?: { name: string; color?: string }[];
  section?: string | null;
}

export interface CalendarMonth {
  year: number;
  month: number; // 0-indexed (0 = January)
  weeks: CalendarWeek[];
}

export interface CalendarWeek {
  days: (CalendarDay | null)[];
}

export interface CalendarDay {
  date: Date;
  dateKey: string; // 'YYYY-MM-DD' format for DnD
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
  events: CalendarEvent[];
}

export interface DraggedEvent {
  event: CalendarEvent;
  originalDate: string;
}

export interface CalendarProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventMove: (eventId: string, newDate: string) => Promise<void>;
  loading?: boolean;
}

// Utility function to format date as 'YYYY-MM-DD'
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Utility to check if two dates are the same day
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
