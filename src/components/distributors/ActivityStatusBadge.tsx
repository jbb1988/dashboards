'use client';

interface ActivityStatusBadgeProps {
  status: 'active' | 'warning' | 'inactive';
  daysSincePurchase: number;
  transactionCount30d: number;
}

export default function ActivityStatusBadge({
  status,
  daysSincePurchase,
  transactionCount30d,
}: ActivityStatusBadgeProps) {
  const configs = {
    active: {
      bg: 'bg-green-500/20',
      text: 'text-green-300',
      border: 'border-green-500/30',
      label: 'Active',
      icon: '●',
    },
    warning: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-300',
      border: 'border-amber-500/30',
      label: 'At Risk',
      icon: '◐',
    },
    inactive: {
      bg: 'bg-red-500/20',
      text: 'text-red-300',
      border: 'border-red-500/30',
      label: 'Inactive',
      icon: '○',
    },
  };

  const config = configs[status];

  return (
    <div
      className={`px-2 py-1 rounded-lg text-[10px] font-medium ${config.bg} ${config.text} border ${config.border} flex items-center gap-1`}
      title={`Last purchase: ${daysSincePurchase} days ago • ${transactionCount30d} transactions (30d)`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}
