'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

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

const STATUS_OPTIONS = [
  { key: 'Green', label: 'On Track', color: '#22C55E' },
  { key: 'Yellow', label: 'At Risk', color: '#F59E0B' },
  { key: 'Red', label: 'Critical', color: '#EF4444' },
  { key: 'Gray', label: 'Complete', color: '#64748B' },
];

const TIMEFRAME_OPTIONS = [
  { key: '30-60', label: '30-60 Days' },
  { key: '90', label: '90 Days' },
  { key: '90+', label: '90+ Days' },
];

const PERCENT_OPTIONS = [
  { key: 'Empty', label: '0%', value: 0 },
  { key: 'Quarter', label: '25%', value: 25 },
  { key: 'Half', label: '50%', value: 50 },
  { key: 'Three Quarter', label: '75%', value: 75 },
  { key: 'Full', label: '100%', value: 100 },
];

const PILLAR_COLORS: Record<string, string> = {
  'REVENUE GROWTH': '#38BDF8',
  'OPERATING RESULTS': '#22C55E',
  'CUSTOMER SATISFACTION': '#F59E0B',
  'TEAM MEMBER SATISFACTION': '#8B5CF6',
};

interface InitiativeDetailDrawerProps {
  initiative: Initiative;
  onClose: () => void;
  onUpdate: (rowId: number, updates: Record<string, string>) => Promise<void>;
  isUpdating: boolean;
}

export default function InitiativeDetailDrawer({
  initiative,
  onClose,
  onUpdate,
  isUpdating,
}: InitiativeDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [editStatus, setEditStatus] = useState(initiative.status);
  const [editTimeframe, setEditTimeframe] = useState(initiative.timeframe);
  const [editPercent, setEditPercent] = useState(
    PERCENT_OPTIONS.find(p => p.value === initiative.percentComplete)?.key || 'Empty'
  );
  const [editComments, setEditComments] = useState(initiative.comments || '');

  const pillarColor = PILLAR_COLORS[initiative.parentPillar || ''] || '#64748B';

  // Reset form when initiative changes
  useEffect(() => {
    setEditStatus(initiative.status);
    setEditTimeframe(initiative.timeframe);
    setEditPercent(PERCENT_OPTIONS.find(p => p.value === initiative.percentComplete)?.key || 'Empty');
    setEditComments(initiative.comments || '');
    setIsEditing(false);
    setSaveError(null);
    setSaveSuccess(false);
  }, [initiative.id]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await onUpdate(initiative.id, {
        status: editStatus || '',
        timeframe: editTimeframe || '',
        percentComplete: editPercent,
        comments: editComments,
      });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditStatus(initiative.status);
    setEditTimeframe(initiative.timeframe);
    setEditPercent(PERCENT_OPTIONS.find(p => p.value === initiative.percentComplete)?.key || 'Empty');
    setEditComments(initiative.comments || '');
    setIsEditing(false);
    setSaveError(null);
  };

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
              <div
                className="w-1.5 h-10 rounded-full"
                style={{ backgroundColor: pillarColor }}
              />
              <div>
                <h2 className="text-[16px] font-semibold text-white">
                  {isEditing ? 'Edit Initiative' : 'Initiative Details'}
                </h2>
                <span className="text-[12px] text-[#64748B]">{initiative.parentPillar}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-lg hover:bg-white/5 text-[#A855F7] hover:text-[#A855F7] transition-colors"
                  title="Edit initiative"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
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
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Success Message */}
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl p-4 text-[13px] text-[#22C55E] flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Changes saved to Smartsheet
            </motion.div>
          )}

          {/* Error Message */}
          {saveError && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-[13px] text-[#EF4444]">
              {saveError}
            </div>
          )}

          {/* Title & Status Badge */}
          <div>
            <div className="flex items-start gap-3 mb-4">
              <span className={`px-2 py-1 rounded text-[11px] font-medium flex-shrink-0 ${
                initiative.siLevel === 'SI-2' ? 'bg-white/10 text-white' :
                initiative.siLevel === 'SI-3' ? 'bg-white/5 text-[#94A3B8]' :
                'bg-white/[0.02] text-[#64748B]'
              }`}>
                {initiative.siLevel}
              </span>
              <h3 className="text-[18px] font-semibold text-white leading-tight">{initiative.title}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className="text-[11px] px-3 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: `${initiative.statusColor}20`, color: initiative.statusColor }}
              >
                {initiative.statusLabel}
              </span>
              {initiative.timeframe && (
                <span className="text-[11px] px-3 py-1.5 rounded-full font-medium bg-[#A855F7]/20 text-[#A855F7]">
                  {initiative.timeframeLabel}
                </span>
              )}
              {initiative.owner && (
                <span className="text-[11px] px-3 py-1.5 rounded-full font-medium bg-white/5 text-[#94A3B8]">
                  {initiative.owner}
                </span>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-[#0F1722] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-[#64748B]">Progress</span>
              <span className="text-[14px] font-semibold text-white">{initiative.percentComplete}%</span>
            </div>
            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${initiative.percentComplete}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full"
                style={{ backgroundColor: pillarColor }}
              />
            </div>
          </div>

          {isEditing ? (
            /* Edit Mode */
            <>
              {/* Status */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-3">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setEditStatus(opt.key)}
                      disabled={isSaving}
                      className={`px-4 py-3 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2 ${
                        editStatus === opt.key
                          ? 'ring-2 ring-offset-2 ring-offset-[#151F2E]'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: `${opt.color}15`,
                        color: opt.color,
                        ...(editStatus === opt.key && { ringColor: opt.color }),
                      }}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-3">Timeframe</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIMEFRAME_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setEditTimeframe(opt.key)}
                      disabled={isSaving}
                      className={`px-4 py-3 rounded-xl text-[13px] font-medium transition-all ${
                        editTimeframe === opt.key
                          ? 'bg-[#A855F7]/20 text-[#A855F7] ring-2 ring-[#A855F7]/50 ring-offset-2 ring-offset-[#151F2E]'
                          : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-3">Progress</label>
                <div className="grid grid-cols-5 gap-2">
                  {PERCENT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setEditPercent(opt.key)}
                      disabled={isSaving}
                      className={`px-3 py-3 rounded-xl text-[13px] font-medium transition-all ${
                        editPercent === opt.key
                          ? 'bg-[#A855F7]/20 text-[#A855F7] ring-2 ring-[#A855F7]/50 ring-offset-2 ring-offset-[#151F2E]'
                          : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-2">Comments</label>
                <textarea
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  disabled={isSaving}
                  rows={5}
                  className="w-full px-4 py-3 bg-[#0F1722] border border-white/[0.06] rounded-xl text-white text-[14px] focus:outline-none focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/20 resize-none"
                  placeholder="Add comments or notes..."
                />
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-[14px] bg-white/5 text-[#8FA3BF] hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 transition-all ${
                    isSaving
                      ? 'bg-[#A855F7]/20 text-[#A855F7] cursor-not-allowed'
                      : 'bg-[#A855F7] text-white hover:bg-[#A855F7]/90'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save to Smartsheet
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* View Mode */
            <>
              {/* Details */}
              <div className="space-y-1">
                {initiative.description && (
                  <div className="py-4 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B] block mb-2">Description</span>
                    <p className="text-[14px] text-white whitespace-pre-wrap">{initiative.description}</p>
                  </div>
                )}

                {initiative.measurement && (
                  <div className="flex items-start justify-between py-4 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Measurement</span>
                    <span className="text-[13px] text-white text-right max-w-[60%]">{initiative.measurement}</span>
                  </div>
                )}

                {initiative.target && (
                  <div className="flex items-start justify-between py-4 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Target Performance</span>
                    <span className="text-[13px] text-white text-right max-w-[60%]">{initiative.target}</span>
                  </div>
                )}

                {initiative.dependency && (
                  <div className="flex items-start justify-between py-4 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Dependency</span>
                    <span className="text-[13px] text-white text-right max-w-[60%]">{initiative.dependency}</span>
                  </div>
                )}

                {initiative.dueDate && (
                  <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Due Date</span>
                    <span className="text-[13px] text-white">{initiative.dueDate}</span>
                  </div>
                )}

                {initiative.priority && (
                  <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Priority</span>
                    <span className="text-[13px] text-white">{initiative.priority}</span>
                  </div>
                )}
              </div>

              {/* Comments */}
              {initiative.comments && (
                <div>
                  <h4 className="text-[12px] font-medium text-[#64748B] mb-2">Comments</h4>
                  <div className="bg-[#0F1722] rounded-xl p-4 text-[13px] text-[#8FA3BF] whitespace-pre-wrap">
                    {initiative.comments}
                  </div>
                </div>
              )}

              {/* Meta Info */}
              <div className="bg-[#0F1722] rounded-xl p-4 space-y-2">
                {initiative.lastUpdated && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#64748B]">Last Updated</span>
                    <span className="text-[#8FA3BF]">{initiative.lastUpdated}</span>
                  </div>
                )}
                {initiative.updatedBy && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#64748B]">Updated By</span>
                    <span className="text-[#8FA3BF]">{initiative.updatedBy}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#64748B]">Row #</span>
                  <span className="text-[#8FA3BF]">{initiative.rowNumber}</span>
                </div>
              </div>

              {/* Edit Button */}
              <div className="pt-4 border-t border-white/[0.06]">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full py-3 px-4 rounded-xl font-medium text-[14px] bg-[#A855F7] text-white hover:bg-[#A855F7]/90 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Initiative
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
