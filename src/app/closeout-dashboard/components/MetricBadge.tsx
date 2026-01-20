/**
 * MetricBadge Component
 * Displays project metrics (revenue, GPM, variance) in a consistent format
 */

interface MetricBadgeProps {
  label: string;
  value: string | number;
  color?: string;
  className?: string;
}

export function MetricBadge({ label, value, color = '#8FA3BF', className = '' }: MetricBadgeProps) {
  return (
    <div className={`flex flex-col items-end ${className}`}>
      <span className="text-xs text-gray-400">{label}</span>
      <span className="font-semibold text-sm" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
