'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface Subtask {
  gid: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  dueOn: string | null;
  assignee: { name: string } | null;
}

interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  dueOn: string | null;
  startOn: string | null;
  assignee: { gid: string; name: string; email: string } | null;
  section: string | null;
  tags: { name: string; color: string }[];
  customFields: { name: string; value: string | number | null; type: string }[];
  notes: string | null;
  createdAt: string;
  modifiedAt: string;
}

// Helper functions
function getCustomField(task: AsanaTask, fieldName: string): string | null {
  const field = task.customFields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
  return field?.value as string | null;
}

function getTaskStatus(task: AsanaTask): 'confirmed' | 'placeholder' | null {
  const hasConfirmedTag = task.tags?.some(t => t?.name?.toLowerCase() === 'confirmed');
  if (hasConfirmedTag) return 'confirmed';
  const hasPlaceholderTag = task.tags?.some(t => t?.name?.toLowerCase() === 'placeholder');
  if (hasPlaceholderTag) return 'placeholder';
  const scheduleStatus = getCustomField(task, 'Schedule Status')?.toLowerCase();
  if (scheduleStatus?.includes('confirmed')) return 'confirmed';
  if (scheduleStatus?.includes('placeholder')) return 'placeholder';
  return null;
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return '';
  return dateStr; // Already in YYYY-MM-DD format from Asana
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isDueThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return date >= now && date <= weekFromNow;
}

const COLORS = {
  confirmed: '#7FBA7A',
  placeholder: '#F1BD6C',
};

// Helper to format notes with clickable, truncated URLs
function formatNotesWithLinks(notes: string): React.ReactNode[] {
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = notes.split(urlPattern);

  return parts.map((part, idx) => {
    if (urlPattern.test(part)) {
      // Reset lastIndex since we're testing again
      urlPattern.lastIndex = 0;

      try {
        const url = new URL(part);
        const displayText = url.hostname.replace('www.', '');

        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#38BDF8] rounded text-[12px] transition-colors max-w-full"
            title={part}
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="truncate">{displayText}</span>
          </a>
        );
      } catch {
        return part;
      }
    }
    return <span key={idx}>{part}</span>;
  });
}

interface TaskDetailDrawerProps {
  task: AsanaTask;
  projectId?: string; // Asana project ID for "Open in Asana" link
  onClose: () => void;
  onComplete?: (taskId: string) => void;
  onUpdate?: () => void; // Callback to refresh data after edit
  isCompleting?: boolean;
  showCompleteButton?: boolean;
}

export default function TaskDetailDrawer({
  task,
  projectId,
  onClose,
  onComplete,
  onUpdate,
  isCompleting = false,
  showCompleteButton = true,
}: TaskDetailDrawerProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState(task.name);
  const [editStartOn, setEditStartOn] = useState(formatDateForInput(task.startOn));
  const [editDueOn, setEditDueOn] = useState(formatDateForInput(task.dueOn));
  const [editNotes, setEditNotes] = useState(task.notes || '');

  // Reset edit form when task changes
  useEffect(() => {
    setEditName(task.name);
    setEditStartOn(formatDateForInput(task.startOn));
    setEditDueOn(formatDateForInput(task.dueOn));
    setEditNotes(task.notes || '');
    setIsEditing(false);
    setSaveError(null);
  }, [task.gid]);

  // Fetch subtasks when task changes
  useEffect(() => {
    async function fetchSubtasks() {
      setLoadingSubtasks(true);
      try {
        const response = await fetch(`/api/asana/tasks?action=subtasks&taskId=${task.gid}`);
        const data = await response.json();
        setSubtasks(data.subtasks || []);
      } catch (error) {
        console.error('Error fetching subtasks:', error);
        setSubtasks([]);
      } finally {
        setLoadingSubtasks(false);
      }
    }
    fetchSubtasks();
  }, [task.gid]);

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/asana/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.gid,
          name: editName !== task.name ? editName : undefined,
          start_on: editStartOn !== formatDateForInput(task.startOn) ? (editStartOn || null) : undefined,
          due_on: editDueOn !== formatDateForInput(task.dueOn) ? (editDueOn || null) : undefined,
          notes: editNotes !== (task.notes || '') ? editNotes : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update task');
      }

      setIsEditing(false);
      if (onUpdate) {
        onUpdate(); // Refresh parent data
      }
    } catch (error) {
      console.error('Error saving task:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setEditName(task.name);
    setEditStartOn(formatDateForInput(task.startOn));
    setEditDueOn(formatDateForInput(task.dueOn));
    setEditNotes(task.notes || '');
    setIsEditing(false);
    setSaveError(null);
  };

  const taskStatus = getTaskStatus(task);
  const statusColor = taskStatus === 'confirmed' ? COLORS.confirmed : taskStatus === 'placeholder' ? COLORS.placeholder : '#64748B';
  const region = getCustomField(task, 'Region');
  const salesLead = getCustomField(task, 'Sales Lead');
  const scheduleStatus = getCustomField(task, 'Schedule Status');
  const category = getCustomField(task, 'Catagory');
  const docuSign = getCustomField(task, 'DocuSign MCC');
  const overdue = isOverdue(task.dueOn || task.startOn);
  const dueThisWeek = isDueThisWeek(task.dueOn || task.startOn);

  // Calculate duration
  const startDate = task.startOn ? new Date(task.startOn) : null;
  const endDate = task.dueOn ? new Date(task.dueOn) : null;
  const duration = startDate && endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 1;

  // Calculate subtask progress
  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

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
        className="fixed right-0 top-0 bottom-0 w-[480px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0F1722] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-[16px] font-semibold text-white">
            {isEditing ? 'Edit Project' : 'Project Details'}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <a
                  href={projectId
                    ? `https://app.asana.com/0/${projectId}/${task.gid}`
                    : `https://app.asana.com/0/0/${task.gid}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/5 text-[#F06A6A] hover:text-[#F06A6A] transition-colors"
                  title="Open in Asana"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-lg hover:bg-white/5 text-[#38BDF8] hover:text-[#38BDF8] transition-colors"
                  title="Edit task"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </>
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {saveError && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-[13px] text-[#EF4444]">
              {saveError}
            </div>
          )}

          {isEditing ? (
            /* Edit Mode */
            <>
              {/* Task Name */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-2">Task Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0F1722] border border-white/[0.06] rounded-xl text-white text-[14px] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#64748B] mb-2">Start Date</label>
                  <input
                    type="date"
                    value={editStartOn}
                    onChange={(e) => setEditStartOn(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0F1722] border border-white/[0.06] rounded-xl text-white text-[14px] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#64748B] mb-2">Due Date</label>
                  <input
                    type="date"
                    value={editDueOn}
                    onChange={(e) => setEditDueOn(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0F1722] border border-white/[0.06] rounded-xl text-white text-[14px] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-2">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 bg-[#0F1722] border border-white/[0.06] rounded-xl text-white text-[14px] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20 resize-none"
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
                      ? 'bg-[#38BDF8]/20 text-[#38BDF8] cursor-not-allowed'
                      : 'bg-[#38BDF8] text-white hover:bg-[#38BDF8]/90'
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
                      Save to Asana
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* View Mode */
            <>
              {/* Title & Status */}
              <div>
                <h3 className="text-[18px] font-semibold text-white mb-3">{task.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {taskStatus && (
                    <span
                      className="text-[11px] px-3 py-1.5 rounded-full font-medium"
                      style={{
                        backgroundColor: statusColor,
                        color: taskStatus === 'placeholder' ? '#1A1F2E' : 'white'
                      }}
                    >
                      {taskStatus === 'confirmed' ? 'Confirmed' : 'Placeholder'}
                    </span>
                  )}
                  {overdue && (
                    <span className="text-[11px] px-3 py-1.5 rounded-full font-medium bg-[#EF4444] text-white">
                      Overdue
                    </span>
                  )}
                  {dueThisWeek && !overdue && (
                    <span className="text-[11px] px-3 py-1.5 rounded-full font-medium bg-[#F59E0B] text-white">
                      Due This Week
                    </span>
                  )}
                  {task.completed && (
                    <span className="text-[11px] px-3 py-1.5 rounded-full font-medium bg-[#22C55E] text-white">
                      Completed
                    </span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="bg-[#0F1722] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#64748B]">Start Date</span>
                  <span className={`text-[13px] font-medium ${task.startOn && isOverdue(task.startOn) ? 'text-[#EF4444]' : 'text-white'}`}>
                    {formatFullDate(task.startOn)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#64748B]">Due Date</span>
                  <span className={`text-[13px] font-medium ${task.dueOn && isOverdue(task.dueOn) ? 'text-[#EF4444]' : 'text-white'}`}>
                    {formatFullDate(task.dueOn)}
                  </span>
                </div>
                {startDate && endDate && (
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Duration</span>
                    <span className="text-[13px] font-medium text-white">{duration} {duration === 1 ? 'day' : 'days'}</span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                  <span className="text-[12px] text-[#64748B]">Assignee</span>
                  <span className="text-[13px] text-white">{task.assignee?.name || 'Unassigned'}</span>
                </div>
                {region && (
                  <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Region</span>
                    <span className="text-[13px] text-white">{region}</span>
                  </div>
                )}
                {salesLead && (
                  <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Sales Lead</span>
                    <span className="text-[13px] text-white">{salesLead}</span>
                  </div>
                )}
                {scheduleStatus && (
                  <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Schedule Status</span>
                    <span className="text-[13px] text-white">{scheduleStatus}</span>
                  </div>
                )}
                {category && (
                  <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Category</span>
                    <span className="text-[13px] text-white">{category}</span>
                  </div>
                )}
                {task.section && (
                  <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">Section</span>
                    <span className="text-[13px] text-white">{task.section}</span>
                  </div>
                )}
                {docuSign && (
                  <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                    <span className="text-[12px] text-[#64748B]">DocuSign MCC</span>
                    <span className="text-[11px] px-2 py-1 rounded bg-[#FFD700]/20 text-[#FFD700]">{docuSign}</span>
                  </div>
                )}
              </div>

              {/* Subtasks */}
              {(subtasks.length > 0 || loadingSubtasks) && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[12px] font-medium text-[#64748B]">Subtasks</h4>
                    {subtasks.length > 0 && (
                      <span className="text-[11px] text-[#8FA3BF]">
                        {completedSubtasks}/{subtasks.length} complete
                      </span>
                    )}
                  </div>
                  {loadingSubtasks ? (
                    <div className="bg-[#0F1722] rounded-xl p-4 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="bg-[#0F1722] rounded-xl overflow-hidden">
                      {/* Progress bar */}
                      {subtasks.length > 0 && (
                        <div className="px-4 pt-3 pb-2">
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${subtaskProgress}%` }}
                              className="h-full bg-gradient-to-r from-[#22C55E] to-[#38BDF8] rounded-full"
                            />
                          </div>
                        </div>
                      )}
                      {/* Subtask list */}
                      <div className="divide-y divide-white/[0.04]">
                        {subtasks.map((subtask) => (
                          <div key={subtask.gid} className="px-4 py-2.5 flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              subtask.completed ? 'bg-[#22C55E] border-[#22C55E]' : 'border-[#475569]'
                            }`}>
                              {subtask.completed && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`flex-1 text-[12px] ${
                              subtask.completed ? 'text-[#64748B] line-through' : 'text-[#EAF2FF]'
                            }`}>
                              {subtask.name}
                            </span>
                            {subtask.assignee && (
                              <span className="text-[10px] text-[#64748B]">
                                {subtask.assignee.name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {task.notes && (
                <div>
                  <h4 className="text-[12px] font-medium text-[#64748B] mb-2">Notes</h4>
                  <div className="bg-[#0F1722] rounded-xl p-4 text-[13px] text-[#8FA3BF] whitespace-pre-wrap break-words overflow-hidden">
                    {formatNotesWithLinks(task.notes)}
                  </div>
                </div>
              )}

              {/* Custom Fields */}
              {task.customFields && task.customFields.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-medium text-[#64748B] mb-3">Additional Fields</h4>
                  <div className="bg-[#0F1722] rounded-xl p-4 space-y-2">
                    {task.customFields.filter(cf => cf.value && !['Region', 'Sales Lead', 'Schedule Status', 'Catagory', 'DocuSign MCC'].includes(cf.name)).map((cf, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[12px]">
                        <span className="text-[#64748B]">{cf.name}</span>
                        <span className="text-[#8FA3BF]">{String(cf.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {showCompleteButton && onComplete && !task.completed && (
                <div className="pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => onComplete(task.gid)}
                    disabled={isCompleting}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 transition-all ${
                      isCompleting
                        ? 'bg-[#22C55E]/20 text-[#22C55E] cursor-not-allowed'
                        : 'bg-[#22C55E] text-white hover:bg-[#22C55E]/90'
                    }`}
                  >
                    {isCompleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark as Complete
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
