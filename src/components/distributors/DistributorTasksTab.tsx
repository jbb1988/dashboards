'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DistributorTask {
  id: string;
  title: string;
  description?: string;
  distributor_name?: string;
  customer_id?: string;
  customer_name?: string;
  location?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  assignee_email?: string;
  assignee_name?: string;
  source: 'manual' | 'ai_insight' | 'auto_churn';
  insight_id?: number;
  asana_gid?: string;
  created_at: string;
  updated_at: string;
}

interface TaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  urgent: number;
}

interface DistributorTasksTabProps {
  selectedYears: number[];
  selectedMonths: number[];
  selectedClass: string | null;
}

const PRIORITY_STYLES = {
  urgent: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: 'Manual', color: '#64748B' },
  ai_insight: { label: 'AI Insight', color: '#14B8A6' },
  auto_churn: { label: 'Churn Alert', color: '#EF4444' },
};

export function DistributorTasksTab({
  selectedYears,
  selectedMonths,
  selectedClass,
}: DistributorTasksTabProps) {
  const [tasks, setTasks] = useState<DistributorTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View and filter state
  const [viewMode, setViewMode] = useState<'list' | 'board'>('board');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<DistributorTask | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch tasks
  useEffect(() => {
    fetchTasks();
  }, [selectedYears, selectedMonths, selectedClass]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/diversified/distributors/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data = await response.json();
      setTasks(data.tasks || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: DistributorTask['status']) => {
    try {
      const response = await fetch('/api/diversified/distributors/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });

      if (response.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`/api/diversified/distributors/tasks?id=${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTasks();
        if (selectedTask?.id === taskId) {
          setIsDrawerOpen(false);
          setSelectedTask(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  // Group tasks by status for Kanban view
  const tasksByStatus = {
    pending: filteredTasks.filter(t => t.status === 'pending'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No due date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 mb-4 animate-pulse">
            <svg className="w-6 h-6 text-[#14B8A6] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-[#94A3B8] text-[14px]">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-400 text-[14px] mb-4">{error}</p>
        <button
          onClick={fetchTasks}
          className="px-4 py-2 rounded-lg bg-[#1E293B] text-white text-[13px] hover:bg-[#334155] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-[#151F2E] border border-white/[0.04] p-4"
          >
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              Total Tasks
            </div>
            <div className="text-2xl font-bold text-white">{summary.total}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl bg-[#151F2E] border border-white/[0.04] p-4"
          >
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              Pending
            </div>
            <div className="text-2xl font-bold text-[#64748B]">{summary.pending}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-[#151F2E] border border-white/[0.04] p-4"
          >
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              In Progress
            </div>
            <div className="text-2xl font-bold text-[#14B8A6]">{summary.in_progress}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl bg-[#151F2E] border border-white/[0.04] p-4"
          >
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              Completed
            </div>
            <div className="text-2xl font-bold text-[#22C55E]">{summary.completed}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl bg-[#151F2E] border border-white/[0.04] p-4"
          >
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              Overdue
            </div>
            <div className="text-2xl font-bold text-[#EF4444]">{summary.overdue}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl bg-[#151F2E] border border-white/[0.04] p-4"
          >
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              Urgent
            </div>
            <div className="text-2xl font-bold text-[#EF4444]">{summary.urgent}</div>
          </motion.div>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#1E293B] text-white text-[13px] border border-white/[0.04] focus:outline-none focus:border-[#14B8A6]/30"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#1E293B] text-white text-[13px] border border-white/[0.04] focus:outline-none focus:border-[#14B8A6]/30"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('board')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              viewMode === 'board'
                ? 'bg-[#14B8A6] text-white'
                : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155]'
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Board
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-[#14B8A6] text-white'
                : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155]'
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            List
          </button>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Pending Column */}
          <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
            <div className="px-4 py-3 bg-[#1E293B] border-b border-white/[0.04]">
              <h3 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#64748B]" />
                Pending ({tasksByStatus.pending.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {tasksByStatus.pending.map((task, idx) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={idx}
                  onStatusChange={handleStatusChange}
                  onClick={() => {
                    setSelectedTask(task);
                    setIsDrawerOpen(true);
                  }}
                />
              ))}
              {tasksByStatus.pending.length === 0 && (
                <div className="text-center py-8 text-[#475569] text-[13px]">
                  No pending tasks
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
            <div className="px-4 py-3 bg-[#1E293B] border-b border-white/[0.04]">
              <h3 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#14B8A6]" />
                In Progress ({tasksByStatus.in_progress.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {tasksByStatus.in_progress.map((task, idx) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={idx}
                  onStatusChange={handleStatusChange}
                  onClick={() => {
                    setSelectedTask(task);
                    setIsDrawerOpen(true);
                  }}
                />
              ))}
              {tasksByStatus.in_progress.length === 0 && (
                <div className="text-center py-8 text-[#475569] text-[13px]">
                  No tasks in progress
                </div>
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
            <div className="px-4 py-3 bg-[#1E293B] border-b border-white/[0.04]">
              <h3 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                Completed ({tasksByStatus.completed.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {tasksByStatus.completed.map((task, idx) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={idx}
                  onStatusChange={handleStatusChange}
                  onClick={() => {
                    setSelectedTask(task);
                    setIsDrawerOpen(true);
                  }}
                />
              ))}
              {tasksByStatus.completed.length === 0 && (
                <div className="text-center py-8 text-[#475569] text-[13px]">
                  No completed tasks
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
          <div className="divide-y divide-white/[0.02]">
            {filteredTasks.map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                index={idx}
                onStatusChange={handleStatusChange}
                onClick={() => {
                  setSelectedTask(task);
                  setIsDrawerOpen(true);
                }}
              />
            ))}
            {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-[#64748B]">
                <p className="text-[14px]">No tasks found</p>
                <p className="text-[12px] mt-1">Adjust your filters or generate insights to create tasks</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Detail Drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            onClose={() => {
              setIsDrawerOpen(false);
              setSelectedTask(null);
            }}
            onStatusChange={handleStatusChange}
            onDelete={handleDeleteTask}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Task Card Component for Kanban
function TaskCard({
  task,
  index,
  onStatusChange,
  onClick,
}: {
  task: DistributorTask;
  index: number;
  onStatusChange: (id: string, status: DistributorTask['status']) => void;
  onClick: () => void;
}) {
  const styles = PRIORITY_STYLES[task.priority];
  const sourceInfo = SOURCE_LABELS[task.source];
  const overdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="p-3 rounded-lg bg-[#0F1824] border border-white/[0.04] hover:border-[#14B8A6]/30 cursor-pointer transition-all group"
    >
      {/* Priority Badge */}
      <div className="flex items-start justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${styles.bg} ${styles.text}`}>
          {task.priority.toUpperCase()}
        </span>
        {task.source !== 'manual' && (
          <span
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${sourceInfo.color}20`,
              color: sourceInfo.color,
            }}
          >
            {sourceInfo.label}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-medium text-white mb-2 line-clamp-2 group-hover:text-[#14B8A6] transition-colors">
        {task.title}
      </h4>

      {/* Location */}
      {(task.distributor_name || task.customer_name) && (
        <div className="text-[11px] text-[#64748B] mb-2">
          {task.distributor_name}{task.customer_name ? ` > ${task.customer_name}` : ''}
        </div>
      )}

      {/* Due Date */}
      {task.due_date && (
        <div className={`text-[11px] flex items-center gap-1 ${overdue ? 'text-[#EF4444]' : 'text-[#94A3B8]'}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex gap-2">
        {task.status === 'pending' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(task.id, 'in_progress');
            }}
            className="flex-1 px-2 py-1 rounded text-[11px] font-medium bg-[#14B8A6]/10 text-[#14B8A6] hover:bg-[#14B8A6]/20 transition-colors"
          >
            Start
          </button>
        )}
        {task.status === 'in_progress' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(task.id, 'completed');
            }}
            className="flex-1 px-2 py-1 rounded text-[11px] font-medium bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors"
          >
            Complete
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Task Row Component for List View
function TaskRow({
  task,
  index,
  onStatusChange,
  onClick,
}: {
  task: DistributorTask;
  index: number;
  onStatusChange: (id: string, status: DistributorTask['status']) => void;
  onClick: () => void;
}) {
  const styles = PRIORITY_STYLES[task.priority];
  const overdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 hover:bg-[#1E293B] cursor-pointer transition-colors"
    >
      {/* Task Info */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
          <h4 className="text-[13px] font-medium text-white">{task.title}</h4>
        </div>
        {(task.distributor_name || task.customer_name) && (
          <div className="text-[11px] text-[#64748B]">
            {task.distributor_name}{task.customer_name ? ` > ${task.customer_name}` : ''}
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="flex items-center">
        <span className={`px-2 py-1 rounded text-[11px] font-semibold ${styles.bg} ${styles.text}`}>
          {task.priority}
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center">
        <select
          value={task.status}
          onChange={(e) => {
            e.stopPropagation();
            onStatusChange(task.id, e.target.value as DistributorTask['status']);
          }}
          className="px-3 py-1 rounded-lg bg-[#1E293B] text-white text-[12px] border border-white/[0.04] focus:outline-none focus:border-[#14B8A6]/30"
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Due Date */}
      <div className="flex items-center">
        <div className={`text-[12px] ${overdue ? 'text-[#EF4444] font-medium' : 'text-[#94A3B8]'}`}>
          {task.due_date
            ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—'}
        </div>
      </div>

      {/* Source */}
      <div className="flex items-center">
        <span className="text-[12px] text-[#64748B]">
          {SOURCE_LABELS[task.source]?.label || task.source}
        </span>
      </div>
    </motion.div>
  );
}

// Task Detail Drawer
function TaskDetailDrawer({
  task,
  onClose,
  onStatusChange,
  onDelete,
}: {
  task: DistributorTask;
  onClose: () => void;
  onStatusChange: (id: string, status: DistributorTask['status']) => void;
  onDelete: (id: string) => void;
}) {
  const styles = PRIORITY_STYLES[task.priority];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl h-full bg-[#0F1824] border-l border-white/[0.08] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-[#0F1824] border-b border-white/[0.04]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Task Details</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#64748B] hover:text-white hover:bg-white/[0.05] transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Priority & Source */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${styles.bg} ${styles.text} ${styles.border} border`}>
              {task.priority.toUpperCase()}
            </span>
            {task.source !== 'manual' && (
              <span
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium border"
                style={{
                  backgroundColor: `${SOURCE_LABELS[task.source].color}20`,
                  color: SOURCE_LABELS[task.source].color,
                  borderColor: `${SOURCE_LABELS[task.source].color}40`,
                }}
              >
                {SOURCE_LABELS[task.source].label}
              </span>
            )}
          </div>

          {/* Title */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">{task.title}</h3>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-[12px] font-semibold text-[#14B8A6] uppercase tracking-wider mb-2">
                Description
              </h4>
              <p className="text-[14px] text-[#94A3B8] whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            {task.distributor_name && (
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                  Distributor
                </h4>
                <p className="text-[14px] text-white">{task.distributor_name}</p>
              </div>
            )}
            {task.customer_name && (
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                  Location
                </h4>
                <p className="text-[14px] text-white">{task.customer_name}</p>
              </div>
            )}
            {task.due_date && (
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                  Due Date
                </h4>
                <p className="text-[14px] text-white">
                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
            {task.assignee_name && (
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                  Assigned To
                </h4>
                <p className="text-[14px] text-white">{task.assignee_name}</p>
              </div>
            )}
          </div>

          {/* Status Actions */}
          <div>
            <h4 className="text-[12px] font-semibold text-[#14B8A6] uppercase tracking-wider mb-3">
              Update Status
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => onStatusChange(task.id, 'pending')}
                className={`px-4 py-3 rounded-lg text-[13px] font-medium border transition-all ${
                  task.status === 'pending'
                    ? 'bg-[#64748B]/20 text-[#64748B] border-[#64748B]/30'
                    : 'bg-[#1E293B] text-[#94A3B8] border-white/[0.04] hover:border-[#64748B]/30'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => onStatusChange(task.id, 'in_progress')}
                className={`px-4 py-3 rounded-lg text-[13px] font-medium border transition-all ${
                  task.status === 'in_progress'
                    ? 'bg-[#14B8A6]/20 text-[#14B8A6] border-[#14B8A6]/30'
                    : 'bg-[#1E293B] text-[#94A3B8] border-white/[0.04] hover:border-[#14B8A6]/30'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => onStatusChange(task.id, 'completed')}
                className={`px-4 py-3 rounded-lg text-[13px] font-medium border transition-all ${
                  task.status === 'completed'
                    ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/30'
                    : 'bg-[#1E293B] text-[#94A3B8] border-white/[0.04] hover:border-[#22C55E]/30'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Delete */}
          <div className="pt-6 border-t border-white/[0.04]">
            <button
              onClick={() => {
                onDelete(task.id);
              }}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors"
            >
              Delete Task
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
