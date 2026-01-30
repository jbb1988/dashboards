/**
 * Date utility functions for Contract Command Center
 */

/**
 * Groups items by date range (Today, This Week, This Month, Older)
 */
export function groupByDateRange<T extends { timestamp: string }>(items: T[]) {
  const today: T[] = [];
  const thisWeek: T[] = [];
  const thisMonth: T[] = [];
  const older: T[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  items.forEach(item => {
    const itemDate = new Date(item.timestamp);

    if (itemDate >= todayStart) {
      today.push(item);
    } else if (itemDate >= weekAgo) {
      thisWeek.push(item);
    } else if (itemDate >= monthAgo) {
      thisMonth.push(item);
    } else {
      older.push(item);
    }
  });

  return { today, thisWeek, thisMonth, older };
}

/**
 * Checks if a timestamp is within the specified number of hours
 */
export function isWithinHours(timestamp: string | undefined, hours: number): boolean {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= hours;
}

/**
 * Formats a date as relative time (e.g., "2h ago", "3d ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Gets the difference in days between two dates
 */
export function differenceInDays(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
