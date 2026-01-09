'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
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

interface ProjectData {
  project: { gid: string; name: string; color: string };
  sections: { gid: string; name: string }[];
  tasks: AsanaTask[];
  stats: { total: number; completed: number; incomplete: number; overdue: number; dueSoon: number; unassigned: number };
  count: number;
  lastUpdated: string;
}

type SmartView = 'needs_attention' | 'this_week' | 'by_status' | 'all' | 'confirmed' | 'placeholder';

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

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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

// Colors
const COLORS = {
  confirmed: '#7FBA7A',
  placeholder: '#F1BD6C',
};

// Task Detail Drawer
function TaskDetailDrawer({
  task,
  onClose,
  onComplete,
  isCompleting,
}: {
  task: AsanaTask;
  onClose: () => void;
  onComplete: (taskId: string) => void;
  isCompleting: boolean;
}) {
  const taskStatus = getTaskStatus(task);
  const statusColor = taskStatus === 'confirmed' ? COLORS.confirmed : taskStatus === 'placeholder' ? COLORS.placeholder : '#64748B';
  const region = getCustomField(task, 'Region');
  const salesLead = getCustomField(task, 'Sales Lead');
  const scheduleStatus = getCustomField(task, 'Schedule Status');
  const overdue = isOverdue(task.dueOn || task.startOn);
  const dueThisWeek = isDueThisWeek(task.dueOn || task.startOn);

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
        <div className="sticky top-0 bg-[#0F1722] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-white">Project Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-[#8FA3BF] hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
            {task.section && (
              <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
                <span className="text-[12px] text-[#64748B]">Section</span>
                <span className="text-[13px] text-white">{task.section}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {task.notes && (
            <div>
              <h4 className="text-[12px] font-medium text-[#64748B] mb-2">Notes</h4>
              <div className="bg-[#0F1722] rounded-xl p-4 text-[13px] text-[#8FA3BF] whitespace-pre-wrap">
                {task.notes}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {task.customFields && task.customFields.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-[#64748B] mb-3">Additional Fields</h4>
              <div className="bg-[#0F1722] rounded-xl p-4 space-y-2">
                {task.customFields.filter(cf => cf.value).map((cf, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[12px]">
                    <span className="text-[#64748B]">{cf.name}</span>
                    <span className="text-[#8FA3BF]">{String(cf.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
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
        </div>
      </motion.div>
    </>
  );
}

// Smart View Tab Button
function ViewTab({ view, activeView, onClick, label, count, icon }: {
  view: SmartView;
  activeView: SmartView;
  onClick: (view: SmartView) => void;
  label: string;
  count?: number;
  icon: React.ReactNode;
}) {
  const isActive = view === activeView;
  return (
    <button
      onClick={() => onClick(view)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-[13px] ${
        isActive
          ? 'bg-[#E16259]/20 text-[#E16259] border border-[#E16259]/30 shadow-[0_0_12px_rgba(225,98,89,0.15)]'
          : 'text-[#8FA3BF] hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className={isActive ? 'text-[#E16259]' : 'text-[#64748B]'}>{icon}</span>
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#E16259]/30' : 'bg-white/10'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Task Row Component - Clickable
function TaskRow({
  task,
  onClick,
  showStatus = true,
}: {
  task: AsanaTask;
  onClick: () => void;
  showStatus?: boolean;
}) {
  const taskStatus = getTaskStatus(task);
  const statusColor = taskStatus === 'confirmed' ? COLORS.confirmed : taskStatus === 'placeholder' ? COLORS.placeholder : null;
  const region = getCustomField(task, 'Region');
  const overdue = isOverdue(task.dueOn || task.startOn);
  const dueThisWeek = isDueThisWeek(task.dueOn || task.startOn);

  return (
    <div
      onClick={onClick}
      className="px-5 py-3.5 flex items-center gap-4 hover:bg-[#1E293B] transition-colors cursor-pointer group"
    >
      {/* Status Indicator */}
      {statusColor && (
        <div className="w-1 h-10 rounded-full" style={{ backgroundColor: statusColor }} />
      )}

      {/* Date */}
      <div className="w-20 text-center">
        <div className={`text-[13px] font-semibold ${overdue ? 'text-[#EF4444]' : dueThisWeek ? 'text-[#F59E0B]' : 'text-white'}`}>
          {formatShortDate(task.startOn || task.dueOn)}
        </div>
      </div>

      {/* Task Name */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white truncate group-hover:text-[#E16259] transition-colors">{task.name}</div>
        <div className="text-[10px] text-[#64748B]">{task.assignee?.name || 'Unassigned'}</div>
      </div>

      {/* Status Badge */}
      {showStatus && taskStatus && (
        <span
          className="text-[9px] px-2 py-1 rounded font-medium"
          style={{
            backgroundColor: statusColor || '#64748B',
            color: taskStatus === 'placeholder' ? '#1A1F2E' : 'white'
          }}
        >
          {taskStatus === 'confirmed' ? 'Confirmed' : 'Placeholder'}
        </span>
      )}

      {/* Region */}
      {region && <span className="text-[10px] text-[#8FA3BF]">{region}</span>}

      {/* Arrow */}
      <svg className="w-4 h-4 text-[#475569] group-hover:text-[#E16259] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

// Collapsible Status Group
function StatusGroup({
  title,
  tasks,
  onTaskClick,
  defaultExpanded = true
}: {
  title: string;
  tasks: AsanaTask[];
  onTaskClick: (task: AsanaTask) => void;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const statusColor = title.includes('Confirm') ? COLORS.confirmed :
                      title.includes('Placeholder') ? COLORS.placeholder : '#64748B';

  return (
    <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3.5 flex items-center justify-between bg-[#0F1722] border-b border-white/[0.06] hover:bg-[#1E293B] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: statusColor }} />
          <span className="font-semibold text-[14px] text-white">{title}</span>
          <span className="text-[11px] text-[#8FA3BF] bg-white/5 px-2 py-0.5 rounded">
            {tasks.length} projects
          </span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg className="w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="divide-y divide-white/[0.04]">
              {tasks.map((task) => (
                <TaskRow key={task.gid} task={task} onClick={() => onTaskClick(task)} showStatus={false} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main Component
export default function SmartProjectsTab({
  data,
  loading,
  onTaskComplete,
}: {
  data: ProjectData | null;
  loading: boolean;
  onTaskComplete?: (taskId: string, completed: boolean) => Promise<void>;
}) {
  const [activeView, setActiveView] = useState<SmartView>('needs_attention');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<AsanaTask | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Handle task completion
  const handleComplete = useCallback(async (taskId: string) => {
    if (!onTaskComplete || completingTaskId) return;

    setCompletingTaskId(taskId);
    try {
      await onTaskComplete(taskId, true);
      setSelectedTask(null);
    } finally {
      setCompletingTaskId(null);
    }
  }, [onTaskComplete, completingTaskId]);

  // Calculate filtered task lists
  const { needsAttentionTasks, thisWeekTasks, byStatusGroups, allTasks, confirmedTasks, placeholderTasks, stats } = useMemo(() => {
    if (!data) return {
      needsAttentionTasks: [],
      thisWeekTasks: [],
      byStatusGroups: {},
      allTasks: [],
      confirmedTasks: [],
      placeholderTasks: [],
      stats: { needsAttention: 0, thisWeek: 0, confirmed: 0, placeholder: 0 }
    };

    const now = new Date();
    const incompleteTasks = data.tasks.filter(t => !t.completed);

    // Filter by search
    const filteredTasks = searchQuery
      ? incompleteTasks.filter(t =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.assignee?.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : incompleteTasks;

    // Needs Attention: Overdue or due this week or placeholder
    const needsAttentionTasks = filteredTasks
      .filter(t => {
        const taskDate = t.startOn || t.dueOn;
        if (!taskDate) return getTaskStatus(t) === 'placeholder';
        return isOverdue(taskDate) || isDueThisWeek(taskDate) || getTaskStatus(t) === 'placeholder';
      })
      .sort((a, b) => {
        const dateA = new Date(a.startOn || a.dueOn || '9999');
        const dateB = new Date(b.startOn || b.dueOn || '9999');
        return dateA.getTime() - dateB.getTime();
      });

    // This Week: Tasks due within 7 days
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisWeekTasks = filteredTasks
      .filter(t => {
        const taskDate = t.startOn || t.dueOn;
        if (!taskDate) return false;
        const date = new Date(taskDate);
        return date >= now && date <= weekFromNow;
      })
      .sort((a, b) => {
        const dateA = new Date(a.startOn || a.dueOn || 0);
        const dateB = new Date(b.startOn || b.dueOn || 0);
        return dateA.getTime() - dateB.getTime();
      });

    // By Status Groups
    const confirmed: AsanaTask[] = [];
    const placeholder: AsanaTask[] = [];
    const other: AsanaTask[] = [];

    filteredTasks.forEach(task => {
      const status = getTaskStatus(task);
      if (status === 'confirmed') confirmed.push(task);
      else if (status === 'placeholder') placeholder.push(task);
      else other.push(task);
    });

    const byStatusGroups = {
      'Confirmed Projects': confirmed,
      'Placeholder (Tentative)': placeholder,
      'Other / Unclassified': other.length > 0 ? other : undefined,
    };

    // Sort all lists by date
    const sortByDate = (tasks: AsanaTask[]) => [...tasks].sort((a, b) => {
      const dateA = new Date(a.startOn || a.dueOn || '9999');
      const dateB = new Date(b.startOn || b.dueOn || '9999');
      return dateA.getTime() - dateB.getTime();
    });

    return {
      needsAttentionTasks,
      thisWeekTasks,
      byStatusGroups,
      allTasks: sortByDate(filteredTasks),
      confirmedTasks: sortByDate(confirmed),
      placeholderTasks: sortByDate(placeholder),
      stats: {
        needsAttention: needsAttentionTasks.length,
        thisWeek: thisWeekTasks.length,
        confirmed: confirmed.length,
        placeholder: placeholder.length,
      }
    };
  }, [data, searchQuery]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#E16259]/20 border-t-[#E16259] rounded-full animate-spin mx-auto mb-4" />
          <div className="text-[#8FA3BF]">Loading projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(0,0,0,0.4), 0 0 20px rgba(225,98,89,0.1)' }}
          onClick={() => setActiveView('all')}
          className={`relative overflow-hidden rounded-xl p-5 bg-[#151F2E] shadow-[0_8px_24px_rgba(0,0,0,0.35)] cursor-pointer transition-all ${activeView === 'all' ? 'border-2 border-[#E16259] ring-2 ring-[#E16259]/20' : 'border border-white/[0.06]'}`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#E16259]" />
          <div className="text-[11px] font-medium text-[#64748B] mb-2">Active Projects</div>
          <div className="text-[28px] font-semibold text-white">{data.stats.incomplete}</div>
          <div className="text-[12px] text-[#8FA3BF] mt-1">In progress</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(0,0,0,0.4), 0 0 20px rgba(239,68,68,0.1)' }}
          onClick={() => setActiveView('needs_attention')}
          className={`relative overflow-hidden rounded-xl p-5 bg-[#151F2E] shadow-[0_8px_24px_rgba(0,0,0,0.35)] cursor-pointer transition-all ${activeView === 'needs_attention' ? 'border-2 border-[#EF4444] ring-2 ring-[#EF4444]/20' : 'border border-white/[0.06]'}`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#EF4444]" />
          <div className="text-[11px] font-medium text-[#64748B] mb-2">Needs Attention</div>
          <div className="text-[28px] font-semibold text-white">{stats.needsAttention}</div>
          <div className="text-[12px] text-[#8FA3BF] mt-1">Action required</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(0,0,0,0.4), 0 0 20px rgba(56,189,248,0.1)' }}
          onClick={() => setActiveView('this_week')}
          className={`relative overflow-hidden rounded-xl p-5 bg-[#151F2E] shadow-[0_8px_24px_rgba(0,0,0,0.35)] cursor-pointer transition-all ${activeView === 'this_week' ? 'border-2 border-[#38BDF8] ring-2 ring-[#38BDF8]/20' : 'border border-white/[0.06]'}`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#38BDF8]" />
          <div className="text-[11px] font-medium text-[#64748B] mb-2">This Week</div>
          <div className="text-[28px] font-semibold text-white">{stats.thisWeek}</div>
          <div className="text-[12px] text-[#8FA3BF] mt-1">Upcoming</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileHover={{ y: -2, boxShadow: `0 12px 32px rgba(0,0,0,0.4), 0 0 20px ${COLORS.confirmed}20` }}
          onClick={() => setActiveView('confirmed')}
          className={`relative overflow-hidden rounded-xl p-5 bg-[#151F2E] shadow-[0_8px_24px_rgba(0,0,0,0.35)] cursor-pointer transition-all ${activeView === 'confirmed' ? 'border-2 border-[#7FBA7A] ring-2 ring-[#7FBA7A]/20' : 'border border-white/[0.06]'}`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: COLORS.confirmed }} />
          <div className="text-[11px] font-medium text-[#64748B] mb-2">Confirmed</div>
          <div className="text-[28px] font-semibold text-white">{stats.confirmed}</div>
          <div className="text-[12px] text-[#8FA3BF] mt-1">Ready to go</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -2, boxShadow: `0 12px 32px rgba(0,0,0,0.4), 0 0 20px ${COLORS.placeholder}20` }}
          onClick={() => setActiveView('placeholder')}
          className={`relative overflow-hidden rounded-xl p-5 bg-[#151F2E] shadow-[0_8px_24px_rgba(0,0,0,0.35)] cursor-pointer transition-all ${activeView === 'placeholder' ? 'border-2 border-[#F1BD6C] ring-2 ring-[#F1BD6C]/20' : 'border border-white/[0.06]'}`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: COLORS.placeholder }} />
          <div className="text-[11px] font-medium text-[#64748B] mb-2">Placeholder</div>
          <div className="text-[28px] font-semibold text-white">{stats.placeholder}</div>
          <div className="text-[12px] text-[#8FA3BF] mt-1">Tentative</div>
        </motion.div>
      </div>

      {/* Search + View Tabs */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-2">
          <ViewTab
            view="needs_attention"
            activeView={activeView}
            onClick={setActiveView}
            label="Needs Attention"
            count={stats.needsAttention}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <ViewTab
            view="this_week"
            activeView={activeView}
            onClick={setActiveView}
            label="This Week"
            count={stats.thisWeek}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <ViewTab
            view="by_status"
            activeView={activeView}
            onClick={setActiveView}
            label="By Status"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <ViewTab
            view="all"
            activeView={activeView}
            onClick={setActiveView}
            label="All Projects"
            count={allTasks.length}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
          />
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 text-[13px] rounded-lg bg-[#0F1722] border border-white/[0.06] text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#E16259]/50 focus:ring-1 focus:ring-[#E16259]/20 w-64"
          />
        </div>
      </div>

      {/* Content Views */}
      <AnimatePresence mode="wait">
        {/* Needs Attention View */}
        {activeView === 'needs_attention' && (
          <motion.div
            key="needs_attention"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {needsAttentionTasks.length === 0 ? (
              <div className="text-center py-16 rounded-xl bg-[#151F2E] border border-white/[0.06]">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#22C55E]/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-[16px] font-medium text-white mb-1">All caught up!</div>
                <div className="text-[13px] text-[#8FA3BF]">No projects need immediate attention</div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="px-5 py-3 bg-[#0F1722] border-b border-white/[0.06] flex items-center gap-3">
                  <span className="w-3 h-3 rounded bg-[#EF4444]" />
                  <span className="font-semibold text-[14px] text-white">Projects Needing Attention</span>
                  <span className="text-[11px] text-[#8FA3BF] bg-white/5 px-2 py-0.5 rounded">{needsAttentionTasks.length} projects</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {needsAttentionTasks.map((task) => (
                    <TaskRow key={task.gid} task={task} onClick={() => setSelectedTask(task)} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* This Week View */}
        {activeView === 'this_week' && (
          <motion.div
            key="this_week"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {thisWeekTasks.length === 0 ? (
              <div className="text-center py-16 rounded-xl bg-[#151F2E] border border-white/[0.06]">
                <div className="text-[16px] font-medium text-white mb-1">No projects this week</div>
                <div className="text-[13px] text-[#8FA3BF]">Nothing scheduled for the next 7 days</div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="px-5 py-3 bg-[#0F1722] border-b border-white/[0.06] flex items-center gap-3">
                  <span className="w-3 h-3 rounded bg-[#38BDF8]" />
                  <span className="font-semibold text-[14px] text-white">Projects Due This Week</span>
                  <span className="text-[11px] text-[#8FA3BF] bg-white/5 px-2 py-0.5 rounded">{thisWeekTasks.length} projects</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {thisWeekTasks.map((task) => (
                    <TaskRow key={task.gid} task={task} onClick={() => setSelectedTask(task)} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* By Status View */}
        {activeView === 'by_status' && (
          <motion.div
            key="by_status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {Object.entries(byStatusGroups).map(([title, tasks]) => {
              if (!tasks || tasks.length === 0) return null;
              return (
                <StatusGroup
                  key={title}
                  title={title}
                  tasks={tasks}
                  onTaskClick={setSelectedTask}
                  defaultExpanded={title !== 'Other / Unclassified'}
                />
              );
            })}
          </motion.div>
        )}

        {/* All Projects View */}
        {activeView === 'all' && (
          <motion.div
            key="all"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
              <div className="px-5 py-3 bg-[#0F1722] border-b border-white/[0.06] flex items-center gap-3">
                <span className="w-3 h-3 rounded bg-[#E16259]" />
                <span className="font-semibold text-[14px] text-white">All Active Projects</span>
                <span className="text-[11px] text-[#8FA3BF] bg-white/5 px-2 py-0.5 rounded">{allTasks.length} projects</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto divide-y divide-white/[0.04]">
                {allTasks.map((task) => (
                  <TaskRow key={task.gid} task={task} onClick={() => setSelectedTask(task)} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Confirmed Projects View */}
        {activeView === 'confirmed' && (
          <motion.div
            key="confirmed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {confirmedTasks.length === 0 ? (
              <div className="text-center py-16 rounded-xl bg-[#151F2E] border border-white/[0.06]">
                <div className="text-[16px] font-medium text-white mb-1">No confirmed projects</div>
                <div className="text-[13px] text-[#8FA3BF]">No projects have been confirmed yet</div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="px-5 py-3 bg-[#0F1722] border-b border-white/[0.06] flex items-center gap-3">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.confirmed }} />
                  <span className="font-semibold text-[14px] text-white">Confirmed Projects</span>
                  <span className="text-[11px] text-[#8FA3BF] bg-white/5 px-2 py-0.5 rounded">{confirmedTasks.length} projects</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {confirmedTasks.map((task) => (
                    <TaskRow key={task.gid} task={task} onClick={() => setSelectedTask(task)} showStatus={false} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Placeholder Projects View */}
        {activeView === 'placeholder' && (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {placeholderTasks.length === 0 ? (
              <div className="text-center py-16 rounded-xl bg-[#151F2E] border border-white/[0.06]">
                <div className="text-[16px] font-medium text-white mb-1">No placeholder projects</div>
                <div className="text-[13px] text-[#8FA3BF]">No tentative projects found</div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
                <div className="px-5 py-3 bg-[#0F1722] border-b border-white/[0.06] flex items-center gap-3">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.placeholder }} />
                  <span className="font-semibold text-[14px] text-white">Placeholder Projects</span>
                  <span className="text-[11px] text-[#8FA3BF] bg-white/5 px-2 py-0.5 rounded">{placeholderTasks.length} projects</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {placeholderTasks.map((task) => (
                    <TaskRow key={task.gid} task={task} onClick={() => setSelectedTask(task)} showStatus={false} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Detail Drawer */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onComplete={handleComplete}
            isCompleting={completingTaskId === selectedTask.gid}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
