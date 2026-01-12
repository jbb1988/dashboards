'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  onUpdate: (rowId: number, updates: Record<string, string>) => Promise<void>;
  isUpdating: boolean;
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

const SI_LEVEL_INDENT: Record<string, number> = {
  'SI-1': 0,
  'SI-2': 0,
  'SI-3': 16,
  'SI-4': 32,
};

export default function InitiativeRow({
  initiative,
  pillarColor,
  onUpdate,
  isUpdating,
}: InitiativeRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editComments, setEditComments] = useState(initiative.comments || '');
  const [localStatus, setLocalStatus] = useState(initiative.status);
  const [localTimeframe, setLocalTimeframe] = useState(initiative.timeframe);
  const [localPercent, setLocalPercent] = useState(
    PERCENT_OPTIONS.find(p => p.value === initiative.percentComplete)?.key || 'Empty'
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onUpdate(initiative.id, {
        status: localStatus || '',
        timeframe: localTimeframe || '',
        percentComplete: localPercent,
        comments: editComments,
      });
      setSaveStatus('saved');
      setIsEditing(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleCancel = () => {
    setLocalStatus(initiative.status);
    setLocalTimeframe(initiative.timeframe);
    setLocalPercent(PERCENT_OPTIONS.find(p => p.value === initiative.percentComplete)?.key || 'Empty');
    setEditComments(initiative.comments || '');
    setIsEditing(false);
  };

  return (
    <div className={`border-b border-white/[0.04] ${saveStatus === 'saved' ? 'bg-green-500/5' : ''}`}>
      {/* Main Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
        style={{ paddingLeft: `${20 + indent}px` }}
      >
        <div className="flex items-center gap-4">
          {/* Expand Icon */}
          <svg
            className={`w-4 h-4 text-[#64748B] transition-transform flex-shrink-0 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* SI Level Badge */}
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
            initiative.siLevel === 'SI-2' ? 'bg-white/10 text-white' :
            initiative.siLevel === 'SI-3' ? 'bg-white/5 text-[#94A3B8]' :
            'bg-white/[0.02] text-[#64748B]'
          }`}>
            {initiative.siLevel}
          </span>

          {/* Title */}
          <span className={`flex-1 truncate ${
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
        </div>
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 bg-[#0F1722] border-t border-white/[0.04]" style={{ paddingLeft: `${20 + indent + 24}px` }}>
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Details */}
                <div className="space-y-4">
                  {initiative.description && (
                    <div>
                      <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Description</label>
                      <p className="text-[13px] text-[#94A3B8] mt-1">{initiative.description}</p>
                    </div>
                  )}

                  {initiative.measurement && (
                    <div>
                      <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Measurement</label>
                      <p className="text-[13px] text-[#94A3B8] mt-1">{initiative.measurement}</p>
                    </div>
                  )}

                  {initiative.target && (
                    <div>
                      <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Target</label>
                      <p className="text-[13px] text-[#94A3B8] mt-1">{initiative.target}</p>
                    </div>
                  )}

                  {initiative.dependency && (
                    <div>
                      <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Dependencies</label>
                      <p className="text-[13px] text-[#94A3B8] mt-1">{initiative.dependency}</p>
                    </div>
                  )}
                </div>

                {/* Right Column - Editable Fields */}
                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Status</label>
                    <div className="flex gap-2 mt-2">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setLocalStatus(opt.key);
                            setIsEditing(true);
                          }}
                          disabled={isUpdating}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-2 ${
                            localStatus === opt.key
                              ? ''
                              : 'opacity-60 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: `${opt.color}20`,
                            color: opt.color,
                            ...(localStatus === opt.key && { boxShadow: `0 0 0 2px #0F1722, 0 0 0 4px ${opt.color}` }),
                          }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timeframe */}
                  <div>
                    <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Timeframe</label>
                    <div className="flex gap-2 mt-2">
                      {TIMEFRAME_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setLocalTimeframe(opt.key);
                            setIsEditing(true);
                          }}
                          disabled={isUpdating}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                            localTimeframe === opt.key
                              ? 'bg-orange-500/20 text-orange-400 ring-2 ring-orange-500/50 ring-offset-1 ring-offset-[#0F1722]'
                              : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#1E293B]/80'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Progress</label>
                    <div className="flex gap-2 mt-2">
                      {PERCENT_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setLocalPercent(opt.key);
                            setIsEditing(true);
                          }}
                          disabled={isUpdating}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                            localPercent === opt.key
                              ? 'bg-orange-500/20 text-orange-400 ring-2 ring-orange-500/50 ring-offset-1 ring-offset-[#0F1722]'
                              : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#1E293B]/80'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="text-[11px] text-[#64748B] uppercase tracking-wider">Comments</label>
                    <textarea
                      value={editComments}
                      onChange={(e) => {
                        setEditComments(e.target.value);
                        setIsEditing(true);
                      }}
                      disabled={isUpdating}
                      rows={3}
                      className="w-full mt-2 px-3 py-2 bg-[#1E293B] rounded-lg text-[13px] text-[#94A3B8] border border-white/[0.06] focus:border-orange-500/50 focus:outline-none resize-none"
                      placeholder="Add comments..."
                    />
                  </div>

                  {/* Save/Cancel */}
                  {isEditing && (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {saveStatus === 'saving' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={isUpdating}
                        className="px-4 py-2 text-[#94A3B8] hover:text-white text-[13px] font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      {saveStatus === 'saved' && (
                        <span className="text-green-400 text-[13px] flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved
                        </span>
                      )}
                      {saveStatus === 'error' && (
                        <span className="text-red-400 text-[13px]">Failed to save</span>
                      )}
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-[11px] text-[#64748B] pt-2 border-t border-white/[0.06]">
                    {initiative.lastUpdated && (
                      <span>Last updated: {initiative.lastUpdated}</span>
                    )}
                    {initiative.updatedBy && (
                      <span>By: {initiative.updatedBy}</span>
                    )}
                    {initiative.dueDate && (
                      <span>Due: {initiative.dueDate}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
