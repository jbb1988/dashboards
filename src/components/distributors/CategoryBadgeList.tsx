'use client';

interface CategoryBadge {
  name: string;
  revenue: number;
  percentage: number;
}

interface CategoryBadgeListProps {
  categories: CategoryBadge[];
  maxDisplay?: number;
}

export default function CategoryBadgeList({ categories, maxDisplay = 3 }: CategoryBadgeListProps) {
  const displayed = categories.slice(0, maxDisplay);
  const remaining = categories.length - maxDisplay;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-[#64748B] uppercase tracking-wider">Categories:</span>
      {displayed.map((cat, idx) => (
        <span
          key={idx}
          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
          title={`${cat.name}: $${cat.revenue.toLocaleString()} (${cat.percentage.toFixed(1)}%)`}
        >
          {cat.name}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-[#64748B]">
          +{remaining} more
        </span>
      )}
    </div>
  );
}
