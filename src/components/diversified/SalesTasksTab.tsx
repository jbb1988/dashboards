'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
  assignee_name?: string | null;
}

interface DiversifiedTask {
  id: string;
  title: string;
  description?: string;
  customer_id?: string;
  customer_name?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  assignee_email?: string;
  assignee_name?: string;
  source: 'manual' | 'ai_insight' | 'auto_churn' | 'asana';
  insight_id?: string;
  section?: string;
  section_gid?: string;
  asana_gid?: string;
  created_at: string;
  updated_at: string;
  // Subtasks
  subtasks?: Subtask[];
  subtask_count?: number;
  subtasks_completed?: number;
}

interface TaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  urgent: number;
  high: number;
}

interface SalesTasksTabProps {
  onCustomerClick?: (customerId: string, customerName: string) => void;
}

const PRIORITY_STYLES = {
  urgent: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
};

const STATUS_STYLES = {
  pending: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Pending' },
  in_progress: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'In Progress' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
  cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Cancelled' },
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  ai_insight: 'AI Insight',
  auto_churn: 'Churn Alert',
  asana: 'Asana',
};

export function SalesTasksTab({ onCustomerClick }: SalesTasksTabProps) {
  const [tasks, setTasks] = useState<DiversifiedTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAsanaConnected, setIsAsanaConnected] = useState(false);

  // View and filter state
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Task detail drawer state
  const [selectedTask, setSelectedTask] = useState<DiversifiedTask | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditingInDrawer, setIsEditingInDrawer] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState<DiversifiedTask['status']>('pending');

  // Add/Edit task state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<DiversifiedTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Open task drawer
  const openTaskDrawer = (task: DiversifiedTask) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || '');
    setEditStatus(task.status);
    setIsEditingInDrawer(false);
    setIsDrawerOpen(true);
  };

  // Close task drawer
  const closeTaskDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTask(null);
    setIsEditingInDrawer(false);
  };

  // Save task edits from drawer
  const handleSaveTaskEdit = async () => {
    if (!selectedTask || !editTitle.trim()) return;
    setIsSaving(true);

    try {
      const response = await fetch('/api/diversified/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          title: editTitle.trim(),
          notes: editDescription.trim() || null,
          due_date: editDueDate || null,
          status: editStatus,
        }),
      });

      if (response.ok) {
        // Update local state
        setTasks(prev => prev.map(t =>
          t.id === selectedTask.id
            ? { ...t, title: editTitle.trim(), description: editDescription.trim(), due_date: editDueDate || undefined, status: editStatus }
            : t
        ));
        setSelectedTask(prev => prev ? { ...prev, title: editTitle.trim(), description: editDescription.trim(), due_date: editDueDate || undefined, status: editStatus } : null);
        setIsEditingInDrawer(false);
        fetchTasks(); // Refresh to get updated data
      }
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch tasks
  const fetchTasks = async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (bustCache) params.set('bust', 'true');

      const response = await fetch(`/api/diversified/tasks?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data = await response.json();
      setTasks(data.tasks || []);
      setSummary(data.summary || null);
      setIsAsanaConnected(data.source === 'asana');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Bust cache on initial load to ensure we get fresh data with subtasks
    fetchTasks(true);
  }, [statusFilter, priorityFilter, sourceFilter]);

  // Create task
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsSaving(true);

    try {
      const response = await fetch('/api/diversified/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          source: 'manual',
        }),
      });

      if (response.ok) {
        await fetchTasks();
        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskPriority('medium');
        setNewTaskDueDate('');
        setIsAddingTask(false);
      }
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Update task status
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/diversified/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });

      if (response.ok) {
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status: newStatus as DiversifiedTask['status'] } : t
        ));
        // Refetch to update summary
        fetchTasks();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;

    try {
      const response = await fetch(`/api/diversified/tasks?id=${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Toggle task selection
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Select all visible tasks
  const selectAllTasks = () => {
    if (selectedTaskIds.size === tasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(tasks.map(t => t.id)));
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  // Bulk delete selected tasks
  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    if (!confirm(`Delete ${selectedTaskIds.size} selected task${selectedTaskIds.size > 1 ? 's' : ''}?`)) return;

    setIsDeleting(true);
    try {
      // Delete all selected tasks in parallel
      const deletePromises = Array.from(selectedTaskIds).map(taskId =>
        fetch(`/api/diversified/tasks?id=${taskId}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      // Update local state
      setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
      setSelectedTaskIds(new Set());
      fetchTasks();
    } catch (err) {
      console.error('Error deleting tasks:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk mark as completed
  const handleBulkComplete = async () => {
    if (selectedTaskIds.size === 0) return;

    setIsDeleting(true); // reuse loading state
    try {
      const updatePromises = Array.from(selectedTaskIds).map(taskId =>
        fetch('/api/diversified/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, status: 'completed' }),
        })
      );

      await Promise.all(updatePromises);

      // Update local state
      setTasks(prev => prev.map(t =>
        selectedTaskIds.has(t.id) ? { ...t, status: 'completed' as const } : t
      ));
      setSelectedTaskIds(new Set());
      fetchTasks();
    } catch (err) {
      console.error('Error completing tasks:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if task is overdue
  const isOverdue = (task: DiversifiedTask) => {
    if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.due_date) < new Date();
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group tasks by status for board view
  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  return (
    <div className="space-y-6">
      {/* Header with KPIs */}
      {summary && (
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-[#151F2E] border border-white/[0.04] rounded-xl p-4">
            <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1">Total Tasks</div>
            <div className="text-2xl font-bold text-white">{summary.total}</div>
          </div>
          <div className="bg-[#151F2E] border border-white/[0.04] rounded-xl p-4">
            <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1">Pending</div>
            <div className="text-2xl font-bold text-slate-400">{summary.pending}</div>
          </div>
          <div className="bg-[#151F2E] border border-white/[0.04] rounded-xl p-4">
            <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1">In Progress</div>
            <div className="text-2xl font-bold text-cyan-400">{summary.in_progress}</div>
          </div>
          <div className="bg-[#151F2E] border border-white/[0.04] rounded-xl p-4">
            <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1">Completed</div>
            <div className="text-2xl font-bold text-green-400">{summary.completed}</div>
          </div>
          <div className="bg-[#151F2E] border border-white/[0.04] rounded-xl p-4">
            <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1">Overdue</div>
            <div className="text-2xl font-bold text-red-400">{summary.overdue}</div>
          </div>
          <div className="bg-[#151F2E] border border-white/[0.04] rounded-xl p-4">
            <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1">Urgent/High</div>
            <div className="text-2xl font-bold text-orange-400">{summary.urgent + summary.high}</div>
          </div>
        </div>
      )}

      {/* Asana Sync Indicator */}
      {isAsanaConnected && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F06A6A]/10 border border-[#F06A6A]/20 rounded-xl">
          <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="6.5" r="3.5" fill="#F06A6A"/>
            <circle cx="6.5" cy="24" r="3.5" fill="#F06A6A"/>
            <circle cx="25.5" cy="24" r="3.5" fill="#F06A6A"/>
          </svg>
          <span className="text-[13px] text-white font-medium">Synced with Asana</span>
          <span className="text-[11px] text-[#64748B]">Diversified Project</span>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4">
        {/* View Toggle + Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-white/[0.04]">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                  : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                viewMode === 'board'
                  ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                  : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </button>
          </div>
          {/* Refresh Button */}
          <button
            onClick={() => fetchTasks(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] hover:text-white hover:bg-[#2D3B4F] transition-all disabled:opacity-50"
            title="Refresh tasks from Asana"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] text-[12px] cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] text-[12px] cursor-pointer"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] text-[12px] cursor-pointer"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="ai_insight">AI Insight</option>
            <option value="auto_churn">Churn Alert</option>
          </select>
        </div>

        {/* Add Task Button */}
        <button
          onClick={() => setIsAddingTask(true)}
          className="px-4 py-2 bg-[#22C55E] text-white rounded-lg text-[13px] font-medium hover:bg-[#22C55E]/80 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>
      </div>

      {/* Add Task Form */}
      <AnimatePresence>
        {isAddingTask && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#151F2E] border border-[#22C55E]/30 rounded-xl overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <h3 className="text-white font-medium">New Task</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Title *</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Enter task title..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-white/10 text-white text-[13px] placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E]"
                    autoFocus
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Description</label>
                  <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-white/10 text-white text-[13px] placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E] resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-white/10 text-white text-[13px] cursor-pointer focus:outline-none focus:border-[#22C55E]"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Due Date</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-white/10 text-white text-[13px] cursor-pointer focus:outline-none focus:border-[#22C55E]"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.04]">
                <button
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                    setNewTaskDescription('');
                    setNewTaskPriority('medium');
                    setNewTaskDueDate('');
                  }}
                  className="px-4 py-2 text-[13px] text-[#94A3B8] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={!newTaskTitle.trim() || isSaving}
                  className="px-4 py-2 text-[13px] bg-[#22C55E] text-white rounded-lg hover:bg-[#22C55E]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-8 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-center">
          <p className="font-medium mb-2">Error loading tasks</p>
          <p className="text-[13px] opacity-80">{error}</p>
          <button
            onClick={() => fetchTasks(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* List View */}
      {!loading && !error && viewMode === 'list' && (
        <div className="bg-[#151F2E] border border-white/[0.04] rounded-xl overflow-hidden">
          {tasks.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-[#475569] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-[#64748B]">No tasks yet</p>
              <p className="text-[12px] text-[#475569] mt-1">
                Create a task or generate insights to add action items
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {/* Select All Header */}
              <div className="px-4 py-3 bg-[#0F172A] flex items-center gap-4 border-b border-white/[0.04]">
                <button
                  onClick={selectAllTasks}
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all border ${
                    selectedTaskIds.size === tasks.length && tasks.length > 0
                      ? 'bg-[#38BDF8] border-[#38BDF8] text-white'
                      : selectedTaskIds.size > 0
                      ? 'bg-[#38BDF8]/50 border-[#38BDF8] text-white'
                      : 'bg-white/5 border-white/20 hover:border-white/40'
                  }`}
                >
                  {selectedTaskIds.size === tasks.length && tasks.length > 0 ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : selectedTaskIds.size > 0 ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                    </svg>
                  ) : null}
                </button>
                <span className="text-[12px] text-[#64748B]">
                  {selectedTaskIds.size > 0
                    ? `${selectedTaskIds.size} of ${tasks.length} selected`
                    : `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
                </span>
                {selectedTaskIds.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-[11px] text-[#38BDF8] hover:text-[#38BDF8]/80 ml-auto"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              {tasks.map((task) => {
                const priorityStyle = PRIORITY_STYLES[task.priority];
                const statusStyle = STATUS_STYLES[task.status];
                const overdue = isOverdue(task);

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => openTaskDrawer(task)}
                    className={`p-4 hover:bg-white/[0.02] transition-colors cursor-pointer ${
                      task.status === 'completed' ? 'opacity-60' : ''
                    } ${overdue ? 'bg-red-500/5' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Selection Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskSelection(task.id);
                        }}
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all border ${
                          selectedTaskIds.has(task.id)
                            ? 'bg-[#38BDF8] border-[#38BDF8] text-white'
                            : 'bg-white/5 border-white/20 hover:border-white/40'
                        }`}
                      >
                        {selectedTaskIds.has(task.id) && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Status Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(task.id, task.status === 'completed' ? 'pending' : 'completed');
                        }}
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all hover:scale-110 ${
                          task.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-white/10 text-white/40 hover:bg-white/20'
                        }`}
                      >
                        {task.status === 'completed' ? (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-current" />
                        )}
                      </button>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`} />
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}>
                            {task.priority}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                          <span className="text-[10px] text-[#64748B] bg-white/5 px-1.5 py-0.5 rounded">
                            {SOURCE_LABELS[task.source]}
                          </span>
                        </div>

                        <h4 className={`text-[14px] font-medium ${
                          task.status === 'completed' ? 'text-[#64748B] line-through' : 'text-white'
                        }`}>
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-[12px] text-[#64748B] mt-1 line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex items-center gap-3 mt-1">
                          {task.customer_name && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCustomerClick?.(task.customer_id || '', task.customer_name || '');
                              }}
                              className="text-[11px] text-cyan-400 hover:text-cyan-300"
                            >
                              {task.customer_name}
                            </button>
                          )}
                          {task.assignee_name && (
                            <span className="text-[11px] text-[#64748B]">
                              Assigned to: <span className="text-white">{task.assignee_name}</span>
                            </span>
                          )}
                          {task.section && task.section !== 'No Section' && (
                            <span className="text-[10px] text-[#64748B] bg-white/5 px-1.5 py-0.5 rounded">
                              {task.section}
                            </span>
                          )}
                          {/* Subtask count indicator - just shows count, details in drawer */}
                          {task.subtask_count && task.subtask_count > 0 && (
                            <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {task.subtasks_completed}/{task.subtask_count}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Due Date & Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {task.due_date && (
                          <span className={`text-[12px] ${overdue ? 'text-red-400' : 'text-[#64748B]'}`}>
                            {overdue && <span className="mr-1">!</span>}
                            {formatDate(task.due_date)}
                          </span>
                        )}

                        {/* Status Dropdown */}
                        <select
                          value={task.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(task.id, e.target.value);
                          }}
                          className="px-2 py-1 rounded bg-[#0F172A] border border-white/10 text-[11px] text-[#94A3B8] cursor-pointer"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>

                        {/* Delete */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(task.id);
                          }}
                          className="p-1.5 text-[#64748B] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Board View (Kanban) */}
      {!loading && !error && viewMode === 'board' && (
        <div className="grid grid-cols-3 gap-4">
          {(['pending', 'in_progress', 'completed'] as const).map((status) => {
            const statusStyle = STATUS_STYLES[status];
            const statusTasks = tasksByStatus[status];

            return (
              <div key={status} className="bg-[#0F172A] border border-white/[0.04] rounded-xl overflow-hidden">
                {/* Column Header */}
                <div className={`px-4 py-3 border-b border-white/[0.04] ${statusStyle.bg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-semibold uppercase ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                    <span className="text-[11px] text-[#64748B] bg-white/10 px-2 py-0.5 rounded-full">
                      {statusTasks.length}
                    </span>
                  </div>
                </div>

                {/* Tasks */}
                <div className="p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
                  {statusTasks.length === 0 ? (
                    <div className="p-4 text-center text-[#475569] text-[12px]">
                      No tasks
                    </div>
                  ) : (
                    statusTasks.map((task) => {
                      const priorityStyle = PRIORITY_STYLES[task.priority];
                      const overdue = isOverdue(task);

                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => openTaskDrawer(task)}
                          className={`bg-[#151F2E] border border-white/[0.04] rounded-lg p-3 cursor-pointer hover:border-white/10 transition-colors ${
                            overdue ? 'border-red-500/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full mt-1 ${priorityStyle.dot}`} />
                            <span className={`text-[9px] font-semibold uppercase px-1 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}>
                              {task.priority}
                            </span>
                          </div>

                          <h4 className="text-[13px] text-white font-medium mb-1 line-clamp-2">
                            {task.title}
                          </h4>

                          {task.due_date && (
                            <div className={`text-[11px] ${overdue ? 'text-red-400' : 'text-[#64748B]'}`}>
                              {overdue ? 'Overdue: ' : 'Due: '}{formatDate(task.due_date)}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.04]">
                            <span className="text-[10px] text-[#475569]">
                              {SOURCE_LABELS[task.source]}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              className="p-1 text-[#475569] hover:text-red-400 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedTaskIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30"
          >
            <div className="flex items-center gap-3 px-6 py-3 bg-[#1E293B] border border-white/10 rounded-2xl shadow-2xl">
              <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                <div className="w-8 h-8 rounded-full bg-[#38BDF8]/20 flex items-center justify-center">
                  <span className="text-[14px] font-bold text-[#38BDF8]">{selectedTaskIds.size}</span>
                </div>
                <span className="text-[13px] text-[#94A3B8]">
                  task{selectedTaskIds.size !== 1 ? 's' : ''} selected
                </span>
              </div>

              <button
                onClick={handleBulkComplete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-[13px] font-medium disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mark Complete
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-[13px] font-medium disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                Delete Selected
              </button>

              <button
                onClick={clearSelection}
                className="p-2 text-[#64748B] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Detail Drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedTask && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeTaskDrawer}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-[480px] bg-[#0F172A] border-l border-white/10 shadow-2xl z-50 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${PRIORITY_STYLES[selectedTask.priority].dot}`} />
                  <span className={`text-[11px] font-semibold uppercase px-2 py-1 rounded ${PRIORITY_STYLES[selectedTask.priority].bg} ${PRIORITY_STYLES[selectedTask.priority].text}`}>
                    {selectedTask.priority}
                  </span>
                  <span className={`text-[11px] px-2 py-1 rounded ${STATUS_STYLES[selectedTask.status].bg} ${STATUS_STYLES[selectedTask.status].text}`}>
                    {STATUS_STYLES[selectedTask.status].label}
                  </span>
                </div>
                <button
                  onClick={closeTaskDrawer}
                  className="p-2 text-[#64748B] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {isEditingInDrawer ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Title</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#1E293B] border border-white/10 text-white text-[14px] focus:outline-none focus:border-[#38BDF8]"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Description</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-[#1E293B] border border-white/10 text-white text-[14px] focus:outline-none focus:border-[#38BDF8] resize-none"
                        placeholder="Add a description..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as DiversifiedTask['status'])}
                          className="w-full px-3 py-2 rounded-lg bg-[#1E293B] border border-white/10 text-white text-[14px] cursor-pointer focus:outline-none focus:border-[#38BDF8]"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5 block">Due Date</label>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#1E293B] border border-white/10 text-white text-[14px] cursor-pointer focus:outline-none focus:border-[#38BDF8]"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white mb-2">{selectedTask.title}</h2>
                      {selectedTask.description ? (
                        <p className="text-[14px] text-[#94A3B8] leading-relaxed">{selectedTask.description}</p>
                      ) : (
                        <p className="text-[14px] text-[#475569] italic">No description</p>
                      )}
                    </div>

                    {/* Task Details */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                        <span className="text-[12px] text-[#64748B]">Status</span>
                        <span className={`text-[12px] px-2 py-1 rounded ${STATUS_STYLES[selectedTask.status].bg} ${STATUS_STYLES[selectedTask.status].text}`}>
                          {STATUS_STYLES[selectedTask.status].label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                        <span className="text-[12px] text-[#64748B]">Priority</span>
                        <span className={`text-[12px] px-2 py-1 rounded ${PRIORITY_STYLES[selectedTask.priority].bg} ${PRIORITY_STYLES[selectedTask.priority].text}`}>
                          {selectedTask.priority.charAt(0).toUpperCase() + selectedTask.priority.slice(1)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                        <span className="text-[12px] text-[#64748B]">Source</span>
                        <span className="text-[12px] text-white">{SOURCE_LABELS[selectedTask.source]}</span>
                      </div>

                      {selectedTask.due_date && (
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                          <span className="text-[12px] text-[#64748B]">Due Date</span>
                          <span className={`text-[12px] ${isOverdue(selectedTask) ? 'text-red-400' : 'text-white'}`}>
                            {isOverdue(selectedTask) && '⚠ '}
                            {new Date(selectedTask.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}

                      {selectedTask.assignee_name && (
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                          <span className="text-[12px] text-[#64748B]">Assignee</span>
                          <span className="text-[12px] text-white">{selectedTask.assignee_name}</span>
                        </div>
                      )}

                      {selectedTask.customer_name && (
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                          <span className="text-[12px] text-[#64748B]">Customer</span>
                          <button
                            onClick={() => {
                              onCustomerClick?.(selectedTask.customer_id || '', selectedTask.customer_name || '');
                              closeTaskDrawer();
                            }}
                            className="text-[12px] text-cyan-400 hover:text-cyan-300"
                          >
                            {selectedTask.customer_name}
                          </button>
                        </div>
                      )}

                      {selectedTask.section && selectedTask.section !== 'No Section' && (
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                          <span className="text-[12px] text-[#64748B]">Section</span>
                          <span className="text-[12px] text-white">{selectedTask.section}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between py-2">
                        <span className="text-[12px] text-[#64748B]">Created</span>
                        <span className="text-[12px] text-[#94A3B8]">
                          {new Date(selectedTask.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Subtasks Section */}
                    {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                      <div className="pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-[10px] text-[#64748B] uppercase tracking-wider">
                            Subtasks ({selectedTask.subtasks_completed}/{selectedTask.subtask_count})
                          </h3>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full transition-all"
                                style={{ width: `${((selectedTask.subtasks_completed || 0) / (selectedTask.subtask_count || 1)) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-purple-400">
                              {Math.round(((selectedTask.subtasks_completed || 0) / (selectedTask.subtask_count || 1)) * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {selectedTask.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className={`flex items-start gap-3 p-3 rounded-lg ${
                                subtask.completed ? 'bg-green-500/5 border border-green-500/10' : 'bg-white/[0.02] border border-white/[0.04]'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                subtask.completed ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-[#64748B]'
                              }`}>
                                {subtask.completed ? (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-current" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] ${subtask.completed ? 'text-[#64748B] line-through' : 'text-white'}`}>
                                  {subtask.title}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  {subtask.assignee_name && (
                                    <span className="text-[10px] text-[#64748B]">
                                      {subtask.assignee_name}
                                    </span>
                                  )}
                                  {subtask.due_date && (
                                    <span className="text-[10px] text-[#64748B]">
                                      Due: {new Date(subtask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="pt-4 border-t border-white/10">
                      <h3 className="text-[10px] text-[#64748B] uppercase tracking-wider mb-3">Quick Actions</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedTask.status !== 'completed' && (
                          <button
                            onClick={() => {
                              handleStatusChange(selectedTask.id, 'completed');
                              setSelectedTask(prev => prev ? { ...prev, status: 'completed' } : null);
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-[13px] font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Mark Complete
                          </button>
                        )}

                        {selectedTask.status === 'pending' && (
                          <button
                            onClick={() => {
                              handleStatusChange(selectedTask.id, 'in_progress');
                              setSelectedTask(prev => prev ? { ...prev, status: 'in_progress' } : null);
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-[13px] font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Start Task
                          </button>
                        )}

                        {selectedTask.status === 'completed' && (
                          <button
                            onClick={() => {
                              handleStatusChange(selectedTask.id, 'pending');
                              setSelectedTask(prev => prev ? { ...prev, status: 'pending' } : null);
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-[13px] font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reopen Task
                          </button>
                        )}

                        <button
                          onClick={() => setIsEditingInDrawer(true)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors text-[13px] font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Task
                        </button>
                      </div>
                    </div>

                    {/* Asana Link */}
                    {selectedTask.asana_gid && (
                      <div className="pt-4 border-t border-white/10">
                        <a
                          href={`https://app.asana.com/0/0/${selectedTask.asana_gid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F06A6A]/10 text-[#F06A6A] rounded-lg hover:bg-[#F06A6A]/20 transition-colors text-[13px] font-medium"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
                            <circle cx="16" cy="6.5" r="3.5" fill="currentColor"/>
                            <circle cx="6.5" cy="24" r="3.5" fill="currentColor"/>
                            <circle cx="25.5" cy="24" r="3.5" fill="currentColor"/>
                          </svg>
                          Open in Asana
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-white/10">
                {isEditingInDrawer ? (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setIsEditingInDrawer(false);
                        setEditTitle(selectedTask.title);
                        setEditDescription(selectedTask.description || '');
                        setEditStatus(selectedTask.status);
                        setEditDueDate(selectedTask.due_date || '');
                      }}
                      className="px-4 py-2 text-[13px] text-[#94A3B8] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTaskEdit}
                      disabled={!editTitle.trim() || isSaving}
                      className="px-6 py-2 text-[13px] bg-[#38BDF8] text-white rounded-lg hover:bg-[#38BDF8]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      handleDeleteTask(selectedTask.id);
                      closeTaskDrawer();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-[13px] font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Task
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
