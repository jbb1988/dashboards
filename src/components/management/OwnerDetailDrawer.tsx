'use client';

import { motion } from 'framer-motion';

interface Initiative {
  id: number;
  title: string;
  status: string | null;
  statusLabel: string;
  statusColor: string;
  percentComplete: number;
  parentPillar: string | null;
  siLevel: string;
}

interface OwnerDetailDrawerProps {
  owner: string;
  initiatives: Initiative[];
  pillarColors: Record<string, string>;
  onClose: () => void;
  onInitiativeClick: (initiative: Initiative) => void;
}

export default function OwnerDetailDrawer({
  owner,
  initiatives,
  pillarColors,
  onClose,
  onInitiativeClick,
}: OwnerDetailDrawerProps) {
  // Calculate stats
  const total = initiatives.length;
  const onTrack = initiatives.filter(i => i.status === 'Green').length;
  const atRisk = initiatives.filter(i => i.status === 'Yellow').length;
  const critical = initiatives.filter(i => i.status === 'Red').length;
  const avgProgress = total > 0
    ? Math.round(initiatives.reduce((sum, i) => sum + i.percentComplete, 0) / total)
    : 0;
  const onTrackPercent = total > 0 ? Math.round((onTrack / total) * 100) : 0;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-[520px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0F1722] border-b border-white/[0.06] px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-white">{owner}</h2>
                <span className="text-[12px] text-[#64748B]">{total} initiatives assigned</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-[#8FA3BF] hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0F1722] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#64748B]">On Track Rate</span>
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: onTrackPercent >= 75 ? '#22C55E' : onTrackPercent >= 50 ? '#F59E0B' : '#EF4444' }}
                >
                  {onTrackPercent}%
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${onTrackPercent}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: onTrackPercent >= 75 ? '#22C55E' : onTrackPercent >= 50 ? '#F59E0B' : '#EF4444' }}
                />
              </div>
            </div>
            <div className="bg-[#0F1722] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#64748B]">Avg Progress</span>
                <span className="text-[14px] font-semibold text-white">{avgProgress}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${avgProgress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full bg-[#A855F7]"
                />
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="flex items-center justify-around py-4 bg-[#0F1722] rounded-xl">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#22C55E]">{onTrack}</p>
              <p className="text-[11px] text-[#64748B]">On Track</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-[#F59E0B]">{atRisk}</p>
              <p className="text-[11px] text-[#64748B]">At Risk</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-[#EF4444]">{critical}</p>
              <p className="text-[11px] text-[#64748B]">Critical</p>
            </div>
          </div>

          {/* Initiatives List */}
          <div>
            <h3 className="text-[13px] font-medium text-[#64748B] mb-3">Initiatives</h3>
            <div className="space-y-2">
              {initiatives.map((init, index) => (
                <motion.button
                  key={init.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onInitiativeClick(init)}
                  className="w-full text-left p-4 rounded-xl bg-[#0F1722] hover:bg-[#0F1722]/80 border border-white/[0.04] hover:border-white/[0.08] transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                      style={{ backgroundColor: init.statusColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-white font-medium truncate group-hover:text-orange-400 transition-colors">
                        {init.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${pillarColors[init.parentPillar || ''] || '#64748B'}20`,
                            color: pillarColors[init.parentPillar || ''] || '#64748B'
                          }}
                        >
                          {init.parentPillar?.replace(' SATISFACTION', '').replace('TEAM MEMBER', 'TEAM')}
                        </span>
                        <span className="text-[11px] text-[#64748B]">{init.percentComplete}% complete</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
