'use client';

interface Initiative {
  id: number;
  rowNumber: number;
  title: string;
  pillar: string | null;
  siLevel: string;
  owner: string | null;
  status: string | null;
  statusLabel: string;
  statusColor: string;
  timeframe: string | null;
  timeframeLabel: string;
  percentComplete: number;
  dueDate: string | null;
  description: string | null;
  comments: string | null;
  measurement: string | null;
  target: string | null;
  lastUpdated: string | null;
  updatedBy: string | null;
  dependency: string | null;
  priority: string | null;
  isPillarRow: boolean;
  parentPillar: string | null;
}

interface InitiativeRowProps {
  initiative: Initiative;
  pillarColor: string;
  onClick: () => void;
  isUpdating?: boolean;
}

const SI_LEVEL_INDENT: Record<string, number> = {
  'SI-1': 0,
  'SI-2': 0,
  'SI-3': 16,
  'SI-4': 32,
};

export default function InitiativeRow({
  initiative,
  pillarColor,
  onClick,
  isUpdating,
}: InitiativeRowProps) {
  // Handle pillar row
  if (initiative.isPillarRow) {
    return (
      <div
        className="px-5 py-4 border-b border-white/[0.06]"
        style={{ backgroundColor: `${pillarColor}10` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-1.5 h-6 rounded-full"
            style={{ backgroundColor: pillarColor }}
          />
          <h3 className="text-white font-bold text-[15px]">{initiative.title}</h3>
        </div>
      </div>
    );
  }

  const indent = SI_LEVEL_INDENT[initiative.siLevel] || 0;

  return (
    <button
      onClick={onClick}
      disabled={isUpdating}
      className={`w-full border-b border-white/[0.04] px-5 py-3 text-left hover:bg-white/[0.02] transition-colors group ${
        isUpdating ? 'opacity-60' : ''
      }`}
      style={{ paddingLeft: `${20 + indent}px` }}
    >
      <div className="flex items-center gap-4">
        {/* SI Level Badge */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
          initiative.siLevel === 'SI-2' ? 'bg-white/10 text-white' :
          initiative.siLevel === 'SI-3' ? 'bg-white/5 text-[#94A3B8]' :
          'bg-white/[0.02] text-[#64748B]'
        }`}>
          {initiative.siLevel}
        </span>

        {/* Title */}
        <span className={`flex-1 truncate group-hover:text-white transition-colors ${
          initiative.siLevel === 'SI-2' ? 'text-white font-medium text-[14px]' : 'text-[#94A3B8] text-[13px]'
        }`}>
          {initiative.title}
        </span>

        {/* Owner */}
        {initiative.owner && (
          <span className="text-[12px] text-[#64748B] flex-shrink-0 w-20 truncate">
            {initiative.owner}
          </span>
        )}

        {/* Timeframe */}
        {initiative.timeframe && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#1E293B] text-[#94A3B8] flex-shrink-0">
            {initiative.timeframeLabel}
          </span>
        )}

        {/* Progress */}
        <div className="w-16 flex-shrink-0">
          <div className="h-1.5 bg-[#0F1722] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${initiative.percentComplete}%`,
                backgroundColor: pillarColor,
              }}
            />
          </div>
        </div>

        {/* Status */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: initiative.statusColor }}
          title={initiative.statusLabel}
        />

        {/* Chevron icon to indicate clickability */}
        <svg
          className="w-4 h-4 text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
