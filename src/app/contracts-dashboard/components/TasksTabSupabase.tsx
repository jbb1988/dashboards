'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '@/lib/supabase';
import { KPICard, KPIIcons } from '@/components/mars-ui';
import { SearchableContractSelect } from '@/components/SearchableContractSelect';
import { SearchableBundleOrContractSelect } from '@/components/SearchableBundleOrContractSelect';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Helper to compare dates in local timezone (not UTC)
// Converts date strings to start of day in local time for accurate comparisons
function getLocalStartOfDay(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  // Parse as local date by appending time, not letting JS interpret as UTC
  const date = new Date(dateString + 'T00:00:00');
  return date;
}

function isTaskOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;

  const dueDateLocal = getLocalStartOfDay(dueDate);
  if (!dueDateLocal) return false;

  // Get today at start of day in local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDateLocal < today;
}

interface Contract {
  id: string;
  salesforceId?: string;
  name: string;
  status: string;
  contractType?: string[];
}

type ViewMode = 'byContract' | 'byBundle' | 'list' | 'board' | 'byDueDate';
type FilterMode = 'all' | 'overdue' | 'pending' | 'completed' | 'myTasks';
type SortMode = 'dueDate' | 'priority' | 'created' | 'contract' | 'status';

// Helper: Format relative due date
function formatRelativeDate(dateStr: string | undefined | null): { text: string; isOverdue: boolean; urgency: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later' | 'none' } {
  if (!dateStr) return { text: 'No due date', isOverdue: false, urgency: 'none' };

  // Parse as local date to avoid timezone issues
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse date as local time by appending T00:00:00
  const dueDate = new Date(dateStr + 'T00:00:00');
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      text: absDays === 1 ? 'Overdue by 1 day' : `Overdue by ${absDays} days`,
      isOverdue: true,
      urgency: 'overdue'
    };
  }
  if (diffDays === 0) return { text: 'Today', isOverdue: false, urgency: 'today' };
  if (diffDays === 1) return { text: 'Tomorrow', isOverdue: false, urgency: 'tomorrow' };
  if (diffDays <= 7) return { text: `In ${diffDays} days`, isOverdue: false, urgency: 'soon' };

  return {
    text: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isOverdue: false,
    urgency: 'later'
  };
}

// Helper: Get initials from email
function getInitials(email: string | undefined | null): string {
  if (!email) return '?';
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Priority sort order
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// Draggable Task Card for Kanban Board
function DraggableTaskCard({
  task,
  columnStatus,
  index,
  onEdit,
  onDelete,
  onOpenContractDetail,
  contracts,
  highlightedTaskId,
}: {
  task: Task;
  columnStatus: 'pending' | 'in_progress' | 'completed';
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onOpenContractDetail?: (contractId: string) => void;
  contracts: Contract[];
  highlightedTaskId?: string | null;
}) {
  // Find the associated contract for this task
  const taskContract = task.contract_salesforce_id
    ? contracts.find(c => c.salesforceId === task.contract_salesforce_id)
    : task.contract_id
    ? contracts.find(c => c.id === task.contract_id)
    : task.contract_name
    ? contracts.find(c => c.name === task.contract_name)
    : null;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id!,
    data: { task, columnStatus },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = isTaskOverdue(task.due_date, task.status);
  const isHighlighted = highlightedTaskId === task.id;

  return (
    <motion.div
      id={`task-${task.id}`}
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`p-3 rounded-lg border bg-[#0B1220] cursor-grab active:cursor-grabbing ${
        isHighlighted ? 'ring-2 ring-[#38BDF8] bg-[#38BDF8]/20 border-[#38BDF8] animate-pulse' :
        isOverdue ? 'border-red-500/30' : 'border-white/[0.04]'
      } ${isDragging ? 'shadow-lg shadow-[#38BDF8]/20 ring-2 ring-[#38BDF8]/30' : 'hover:border-white/[0.08]'}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <p className="text-sm text-white font-medium flex-1">{task.title}</p>
        {task.is_auto_generated && (
          <span className="text-[8px] px-1 py-0.5 bg-[#38BDF8]/10 text-[#38BDF8] rounded flex-shrink-0">
            AUTO
          </span>
        )}
        {task.bundle_id && (
          <span className="text-[8px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded flex-shrink-0 flex items-center gap-0.5">
            📦 BUNDLE
          </span>
        )}
      </div>
      {task.bundle_id && task.bundle_name && (
        <p className="text-xs text-purple-400 mt-1 truncate">{task.bundle_name}</p>
      )}
      {!task.bundle_id && task.contract_name && (
        <p className="text-xs text-[#38BDF8] mt-1 truncate">{task.contract_name}</p>
      )}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-[#64748B]'}`}>
              {isOverdue && '⚠ '}
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
            task.priority === 'urgent' ? 'bg-red-500/15 text-red-400' :
            task.priority === 'high' ? 'bg-orange-500/15 text-orange-400' :
            task.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
            'bg-[#475569]/20 text-[#64748B]'
          }`}>
            {task.priority}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {taskContract && onOpenContractDetail && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenContractDetail(taskContract.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-[#38BDF8]/20 text-[#64748B] hover:text-[#38BDF8] transition-colors"
              title="View contract details"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-white/[0.04] text-[#64748B] hover:text-white transition-colors"
            title="Edit task"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id!);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-red-500/20 text-[#64748B] hover:text-red-400 transition-colors"
            title="Delete task"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Droppable column wrapper for Kanban
function DroppableColumn({
  id,
  status,
  children,
}: {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 space-y-2 min-h-[300px] transition-colors ${
        isOver ? 'bg-[#38BDF8]/5' : ''
      }`}
    >
      {children}
    </div>
  );
}

interface TasksTabProps {
  contracts: Contract[];
  onOpenContractDetail?: (contractId: string) => void;
  focusMode?: boolean;
  highlightedTaskId?: string | null;
  onClearHighlight?: () => void;
}

/**
 * Tasks Tab Component - Supabase Backend
 *
 * Features:
 * - View by contract, list, or kanban board
 * - Quick filters (all, overdue, pending, completed)
 * - Inline task creation and editing
 * - Auto-generated task indicators
 */
export default function TasksTabSupabase({ contracts, onOpenContractDetail, focusMode = false, highlightedTaskId, onClearHighlight }: TasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('byContract');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Bundle support state
  const [bundles, setBundles] = useState<any[]>([]);
  const [bundledContractIds, setBundledContractIds] = useState<Set<string>>(new Set());

  const [newTask, setNewTask] = useState<{
    title: string;
    contractSalesforceId: string;
    contractName?: string;
    bundleId?: string;
    bundleName?: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    description?: string;
  }>({
    title: '',
    contractSalesforceId: '',
    dueDate: '',
    priority: 'medium',
    description: '',
  });

  // New state for 10X improvements
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('dueDate');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set(['overdue', 'today', 'thisWeek']));
  const [showCompleted, setShowCompleted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Clear filters when focus mode is activated
  useEffect(() => {
    if (focusMode) {
      setFilter('all');
      setSearchQuery('');
    }
  }, [focusMode]);

  // Fetch tasks from Supabase
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch bundles and track which contracts are bundled
  const fetchBundles = useCallback(async () => {
    try {
      const response = await fetch('/api/bundles');
      if (response.ok) {
        const data = await response.json();
        const fetchedBundles = data.bundles || [];

        // Map API response to component interface (contract_count -> contractCount)
        const mappedBundles = fetchedBundles.map((bundle: any) => ({
          id: bundle.id,
          name: bundle.name,
          accountName: bundle.account_name,
          contractCount: bundle.contract_count || 0,
        }));
        setBundles(mappedBundles);

        // Fetch detailed info for each bundle to get contract IDs
        const contractIdsInBundles = new Set<string>();
        await Promise.all(
          fetchedBundles.map(async (bundle: any) => {
            try {
              const bundleDetailsResponse = await fetch(`/api/bundles?bundleId=${bundle.id}`);
              if (bundleDetailsResponse.ok) {
                const bundleData = await bundleDetailsResponse.json();
                bundleData.contracts?.forEach((bc: any) => {
                  if (bc.contract_id) {
                    contractIdsInBundles.add(bc.contract_id);
                  }
                });
              }
            } catch (err) {
              console.error(`Failed to fetch bundle ${bundle.id}:`, err);
            }
          })
        );
        setBundledContractIds(contractIdsInBundles);
      }
    } catch (err) {
      console.error('Failed to fetch bundles:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchBundles();
  }, [fetchTasks, fetchBundles]);

  // Handle task highlighting when navigated from contract drawer
  useEffect(() => {
    if (highlightedTaskId && tasks.length > 0) {
      // Find the task to determine which contract/group it belongs to
      const task = tasks.find(t => t.id === highlightedTaskId);

      if (task) {
        // Expand the contract/group that contains this task in byContract view
        if (viewMode === 'byContract') {
          const contractKey = task.bundle_id
            ? `bundle-${task.bundle_id}`
            : task.contract_name || 'Unassigned';
          setExpandedContracts(prev => new Set([...prev, contractKey]));
        }

        // Wait for DOM to update with expanded sections
        setTimeout(() => {
          const taskElement = document.getElementById(`task-${highlightedTaskId}`);
          if (taskElement) {
            taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }

      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        onClearHighlight?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [highlightedTaskId, onClearHighlight, tasks, viewMode]);

  // Filter out contracts that are in bundles to avoid duplicates in dropdown
  const unbundledContracts = useMemo(() => {
    return contracts.filter(contract => !bundledContractIds.has(contract.id));
  }, [contracts, bundledContractIds]);

  // Task KPIs
  const taskKpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalActive = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
    const overdue = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled' || !t.due_date) return false;
      // Use local date parsing for consistent timezone handling
      const due = new Date(t.due_date + 'T00:00:00');
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;
    const dueToday = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled' || !t.due_date) return false;
      // Use local date parsing for consistent timezone handling
      const due = new Date(t.due_date + 'T00:00:00');
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    }).length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { totalActive, overdue, dueToday, completed, progressPercent, total };
  }, [tasks]);

  // Group tasks by contract
  const tasksByContract = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    tasks.forEach(task => {
      let key: string;

      if (task.bundle_id) {
        // For bundle tasks, use the bundle's account name
        const bundle = bundles.find(b => b.id === task.bundle_id);
        key = bundle?.accountName || task.bundle_name || 'Unassigned';
      } else {
        // For regular contract tasks, use contract name
        key = task.contract_name || 'Unassigned';
      }

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(task);
    });

    return Array.from(grouped.entries())
      .map(([contractName, contractTasks]) => ({
        contractName,
        tasks: contractTasks,
        overdueCount: contractTasks.filter(t =>
          isTaskOverdue(t.due_date, t.status)
        ).length,
        activeCount: contractTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
        totalCount: contractTasks.length,
      }))
      .sort((a, b) => b.overdueCount - a.overdueCount || b.activeCount - a.activeCount);
  }, [tasks, bundles]);

  // Group tasks by bundle
  const tasksByBundle = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    tasks.forEach(task => {
      if (task.bundle_id) {
        // Bundle tasks
        const key = task.bundle_name || 'Unnamed Bundle';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(task);
      } else {
        // Individual contract tasks
        if (!grouped.has('Individual Tasks')) grouped.set('Individual Tasks', []);
        grouped.get('Individual Tasks')!.push(task);
      }
    });

    return Array.from(grouped.entries())
      .map(([groupName, groupTasks]) => ({
        groupName,
        isBundle: groupName !== 'Individual Tasks',
        tasks: groupTasks,
        overdueCount: groupTasks.filter(t =>
          isTaskOverdue(t.due_date, t.status)
        ).length,
        activeCount: groupTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
        totalCount: groupTasks.length,
      }))
      .sort((a, b) => {
        // Sort bundles first, then by overdue/active count
        if (a.isBundle && !b.isBundle) return -1;
        if (!a.isBundle && b.isBundle) return 1;
        return b.overdueCount - a.overdueCount || b.activeCount - a.activeCount;
      });
  }, [tasks]);

  // Group tasks by status for board view
  const tasksByStatus = useMemo(() => ({
    pending: tasks.filter(t => t.status === 'pending'),
    inProgress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  }), [tasks]);

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesContract = task.contract_name?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesContract) return false;
      }

      // Completed/Incomplete toggle filter (takes precedence)
      if (showCompleted) {
        if (task.status !== 'completed') return false;
      } else {
        if (task.status === 'completed') return false;
      }

      // Status filter
      if (filter === 'all') return true;
      if (filter === 'overdue') {
        return isTaskOverdue(task.due_date, task.status);
      }
      if (filter === 'pending') return task.status === 'pending' || task.status === 'in_progress';
      if (filter === 'completed') return task.status === 'completed';
      if (filter === 'myTasks') return task.assignee_email; // Show assigned tasks
      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (PRIORITY_ORDER[a.priority] || 3) - (PRIORITY_ORDER[b.priority] || 3);
        case 'created':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'contract':
          return (a.contract_name || 'zzz').localeCompare(b.contract_name || 'zzz');
        case 'status':
          const statusOrder = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        case 'dueDate':
        default:
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          const aDate = getLocalStartOfDay(a.due_date);
          const bDate = getLocalStartOfDay(b.due_date);
          if (!aDate || !bDate) return 0;
          return aDate.getTime() - bDate.getTime();
      }
    });

    return result;
  }, [tasks, filter, searchQuery, sortBy, showCompleted]);

  // Tasks grouped by due date for "By Due Date" view
  const tasksByDueDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDueDate: [],
    };

    filteredTasks.forEach(task => {
      if (task.status === 'completed' || task.status === 'cancelled') return;

      if (!task.due_date) {
        groups.noDueDate.push(task);
        return;
      }

      // Use local date parsing for consistent timezone handling
      const dueDate = new Date(task.due_date + 'T00:00:00');
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) groups.overdue.push(task);
      else if (dueDate.getTime() === today.getTime()) groups.today.push(task);
      else if (dueDate.getTime() === tomorrow.getTime()) groups.tomorrow.push(task);
      else if (dueDate < weekEnd) groups.thisWeek.push(task);
      else groups.later.push(task);
    });

    return groups;
  }, [filteredTasks]);

  // Handlers

  // Auto-update CS/NS in Salesforce with task title
  const updateCSNSWithTaskTitle = async (taskTitle: string) => {
    let salesforceId: string | undefined;
    let contractName: string | undefined;

    if (newTask.bundleId) {
      // For bundles, get the primary contract's salesforceId
      try {
        const bundleResponse = await fetch(`/api/bundles?bundleId=${newTask.bundleId}`);
        if (bundleResponse.ok) {
          const bundle = await bundleResponse.json();
          const primaryContract = bundle.contracts?.find((c: { is_primary: boolean; contracts?: { salesforce_id?: string; name?: string } }) => c.is_primary);
          if (primaryContract?.contracts?.salesforce_id) {
            salesforceId = primaryContract.contracts.salesforce_id;
            contractName = primaryContract.contracts.name;
          } else if (bundle.contracts?.length > 0) {
            // Fallback: use first contract
            salesforceId = bundle.contracts[0].contracts?.salesforce_id;
            contractName = bundle.contracts[0].contracts?.name;
          }
        }
      } catch (err) {
        console.error('Failed to fetch bundle for CS/NS update:', err);
        return;
      }
    } else if (newTask.contractSalesforceId) {
      salesforceId = newTask.contractSalesforceId;
      const contract = contracts.find(c => c.salesforceId === newTask.contractSalesforceId);
      contractName = contract?.name;
    }

    if (!salesforceId) {
      console.warn('No salesforceId available for CS/NS update');
      return;
    }

    try {
      const updateResponse = await fetch('/api/contracts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesforceId,
          contractName,
          updates: {
            currentSituation: taskTitle.substring(0, 255) // Truncate to SF limit
          }
        }),
      });

      if (updateResponse.ok) {
        const result = await updateResponse.json();
        if (result.bundleInfo) {
          console.log(`CS/NS updated for ${result.bundleInfo.contractCount} bundled contracts`);
        }
      }
    } catch (err) {
      console.error('Error updating CS/NS:', err);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;

    const contract = contracts.find(c => c.salesforceId === newTask.contractSalesforceId);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || undefined,
          contractSalesforceId: newTask.contractSalesforceId || undefined,
          contractName: contract?.name || newTask.contractName,
          bundleId: newTask.bundleId || undefined,
          bundleName: newTask.bundleName || undefined,
          dueDate: newTask.dueDate || undefined,
          priority: newTask.priority,
          status: 'pending',
          isAutoGenerated: false,
        }),
      });

      if (response.ok) {
        // AUTO-UPDATE CS/NS with task title
        if (newTask.contractSalesforceId || newTask.bundleId) {
          await updateCSNSWithTaskTitle(newTask.title.trim());
        }

        await fetchTasks();
        setNewTask({ title: '', contractSalesforceId: '', dueDate: '', priority: 'medium', description: '' });
        setShowAddTask(false);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask?.id) return;

    // Find contract name if salesforce ID is set
    const contract = contracts.find(c => c.salesforceId === editingTask.contract_salesforce_id);

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTask.id,
          title: editingTask.title,
          description: editingTask.description || null,
          status: editingTask.status,
          priority: editingTask.priority,
          dueDate: editingTask.due_date,
          contractSalesforceId: editingTask.contract_salesforce_id || null,
          contractName: contract?.name || null,
          bundleId: editingTask.bundle_id || null,
          bundleName: editingTask.bundle_name || null,
        }),
      });

      if (response.ok) {
        await fetchTasks();
        setEditingTask(null);
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const toggleTaskStatus = async (taskId: string, newStatus: 'pending' | 'completed') => {
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      await fetchTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const toggleContractExpanded = (contractName: string) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractName)) {
      newExpanded.delete(contractName);
    } else {
      newExpanded.add(contractName);
    }
    setExpandedContracts(newExpanded);
  };

  const toggleDateGroupExpanded = (groupKey: string) => {
    const newExpanded = new Set(expandedDateGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedDateGroups(newExpanded);
  };

  // Quick Add Task Handler
  const handleQuickAdd = async () => {
    if (!quickAddTitle.trim()) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickAddTitle.trim(),
          priority: 'medium',
          status: 'pending',
          is_auto_generated: false,
        }),
      });

      if (response.ok) {
        await fetchTasks();
        setQuickAddTitle('');
      }
    } catch (err) {
      console.error('Failed to quick add task:', err);
    }
  };

  // Bulk Actions Handlers
  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const selectAllTasks = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id!)));
    }
  };

  const handleBulkStatusChange = async (newStatus: Task['status']) => {
    try {
      await Promise.all(
        Array.from(selectedTasks).map(taskId =>
          fetch('/api/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taskId, status: newStatus }),
          })
        )
      );
      await fetchTasks();
      setSelectedTasks(new Set());
    } catch (err) {
      console.error('Failed to bulk update:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedTasks.size} tasks?`)) return;
    try {
      await Promise.all(
        Array.from(selectedTasks).map(taskId =>
          fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' })
        )
      );
      await fetchTasks();
      setSelectedTasks(new Set());
    } catch (err) {
      console.error('Failed to bulk delete:', err);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          setShowAddTask(false);
          setEditingTask(null);
        }
        return;
      }

      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault();
          setShowAddTask(true);
          break;
        case '/':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case 'Escape':
          setShowAddTask(false);
          setEditingTask(null);
          setSelectedTasks(new Set());
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drag handlers for Kanban
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;

    // Determine new status from drop target data
    // over.data.current contains { status } for columns or { columnStatus } for tasks
    let newStatus: Task['status'] | null = null;
    const overData = over.data.current as { status?: Task['status']; columnStatus?: Task['status'] } | undefined;

    if (overData?.status) {
      // Dropped on a column
      newStatus = overData.status;
    } else if (overData?.columnStatus) {
      // Dropped on a task (use that task's column)
      newStatus = overData.columnStatus;
    }

    if (!newStatus) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus! } : t));

    // API update
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update task status:', err);
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Task Row Component
  const TaskRow = ({ task, showContract = false, index = 0, showSelection = false }: { task: Task; showContract?: boolean; index?: number; showSelection?: boolean }) => {
    // Find the associated contract for this task
    const taskContract = task.contract_salesforce_id
      ? contracts.find(c => c.salesforceId === task.contract_salesforce_id)
      : task.contract_id
      ? contracts.find(c => c.id === task.contract_id)
      : task.contract_name
      ? contracts.find(c => c.name === task.contract_name)
      : null;
    // Use isTaskOverdue helper for consistent timezone handling
    const isOverdue = isTaskOverdue(task.due_date, task.status);
    const isCompleted = task.status === 'completed';
    const isSelected = selectedTasks.has(task.id!);
    const relativeDate = formatRelativeDate(task.due_date);

    const isHighlighted = highlightedTaskId === task.id;

    return (
      <motion.div
        id={`task-${task.id}`}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10, height: 0 }}
        transition={{ delay: index * 0.03, duration: 0.2 }}
        whileHover={{ scale: 1.005, transition: { duration: 0.1 } }}
        onClick={() => {
          if (taskContract && onOpenContractDetail) {
            onOpenContractDetail(taskContract.id);
          }
        }}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all cursor-pointer ${
          isHighlighted ? 'ring-2 ring-[#38BDF8] bg-[#38BDF8]/20 border-[#38BDF8] animate-pulse' :
          isSelected ? 'bg-[#38BDF8]/10 border-[#38BDF8]/40' :
          isCompleted ? 'bg-[#0B1220]/30 border-white/[0.02] opacity-50' :
          isOverdue ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10' :
          'bg-[#0B1220] border-white/[0.04] hover:border-[#38BDF8]/30 hover:bg-[#0B1220]/80'
        }`}
      >
        {/* Selection Checkbox */}
        {showSelection && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); toggleTaskSelection(task.id!); }}
            whileTap={{ scale: 0.9 }}
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              isSelected ? 'bg-[#38BDF8] border-[#38BDF8]' : 'border-[#475569] hover:border-[#38BDF8]'
            }`}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-[#0B1220]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </motion.button>
        )}

        {/* Status Checkbox */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id!, isCompleted ? 'pending' : 'completed'); }}
          whileTap={{ scale: 0.9 }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            isCompleted ? 'bg-[#22C55E] border-[#22C55E]' : 'border-[#475569] hover:border-[#38BDF8] hover:shadow-[0_0_8px_rgba(56,189,248,0.3)]'
          }`}
        >
          {isCompleted && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
        </motion.button>

        {/* Task content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium transition-all ${isCompleted ? 'text-[#64748B] line-through' : 'text-white'}`}>
              {task.title}
            </p>
            {task.is_auto_generated && (
              <span className="text-[9px] px-1.5 py-0.5 bg-[#38BDF8]/10 text-[#38BDF8] rounded font-medium">
                AUTO
              </span>
            )}
            {task.bundle_id && (
              <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-medium flex items-center gap-1">
                <span>📦</span>
                <span>BUNDLE</span>
              </span>
            )}
            {task.description && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedTasks(prev => {
                    const next = new Set(prev);
                    if (next.has(task.id!)) {
                      next.delete(task.id!);
                    } else {
                      next.add(task.id!);
                    }
                    return next;
                  });
                }}
                className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded font-medium hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                title="View notes"
              >
                <span>📝</span>
                <span>NOTES</span>
                <svg
                  className={`w-2.5 h-2.5 transition-transform ${expandedTasks.has(task.id!) ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* Expandable notes section */}
          <AnimatePresence>
            {task.description && expandedTasks.has(task.id!) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 overflow-hidden"
              >
                <div className="bg-[#0B1220] rounded-lg p-3 border border-white/[0.08]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase">Notes</span>
                    <div className="flex-1 h-px bg-white/[0.08]"></div>
                  </div>
                  <p className="text-xs text-[#8FA3BF] whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {task.bundle_id && task.bundle_name && (
            <p className="text-purple-400 text-xs truncate">{task.bundle_name}</p>
          )}
          {!task.bundle_id && showContract && task.contract_name && (
            <p className="text-[#38BDF8] text-xs truncate">{task.contract_name}</p>
          )}
        </div>

        {/* Assignee Avatar */}
        {task.assignee_email ? (
          <div
            className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center text-[9px] font-bold flex-shrink-0"
            title={task.assignee_email}
          >
            {getInitials(task.assignee_email)}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#475569]/20 text-[#475569] flex items-center justify-center text-[9px] flex-shrink-0" title="Unassigned">
            ?
          </div>
        )}

        {/* Due date - Relative */}
        <div className={`text-xs flex-shrink-0 flex items-center gap-1 min-w-[90px] ${
          relativeDate.urgency === 'overdue' ? 'text-red-400 font-medium' :
          relativeDate.urgency === 'today' ? 'text-amber-400 font-medium' :
          relativeDate.urgency === 'tomorrow' ? 'text-amber-300' :
          relativeDate.urgency === 'soon' ? 'text-[#38BDF8]' :
          'text-[#64748B]'
        }`}>
          {relativeDate.isOverdue && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              ⚠
            </motion.span>
          )}
          {relativeDate.text}
        </div>

        {/* Priority badge */}
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 font-medium ${
          task.priority === 'urgent' ? 'bg-red-500/15 text-red-400' :
          task.priority === 'high' ? 'bg-orange-500/15 text-orange-400' :
          task.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
          'bg-[#475569]/20 text-[#64748B]'
        }`}>
          {task.priority}
        </span>

        {/* Contract Detail button - only show if task is linked to a contract */}
        {taskContract && onOpenContractDetail && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onOpenContractDetail(taskContract.id);
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg hover:bg-[#38BDF8]/20 text-[#64748B] hover:text-[#38BDF8] transition-colors flex-shrink-0"
            title="View contract details"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </motion.button>
        )}

        {/* Edit button */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-[#64748B] hover:text-white transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </motion.button>

        {/* Delete button */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            deleteTask(task.id!);
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-lg hover:bg-red-500/20 text-[#64748B] hover:text-red-400 transition-colors flex-shrink-0"
          title="Delete task"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </motion.button>
      </motion.div>
    );
  };

  // Handle KPI card click to filter tasks
  const handleKPIClick = (filterKey: string) => {
    setFilter(filterKey as FilterMode);
  };

  return (
    <div className="space-y-6">
      {/* Interactive KPI Cards - Match Pipeline Styling */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Active Tasks"
          value={taskKpis.totalActive}
          subtitle={`${taskKpis.total} total tasks`}
          icon={KPIIcons.clipboard}
          color="#38BDF8"
          delay={0.1}
          isActive={filter === 'all'}
          onClick={() => handleKPIClick('all')}
        />
        <KPICard
          title="Overdue"
          value={taskKpis.overdue}
          subtitle="Past due date"
          icon={KPIIcons.alert}
          color="#EF4444"
          delay={0.2}
          isActive={filter === 'overdue'}
          onClick={() => handleKPIClick('overdue')}
          badge={taskKpis.overdue > 0 ? taskKpis.overdue : undefined}
        />
        <KPICard
          title="Due Today"
          value={taskKpis.dueToday}
          subtitle="Requires attention"
          icon={KPIIcons.clock}
          color="#F59E0B"
          delay={0.3}
          isActive={filter === 'pending'}
          onClick={() => handleKPIClick('pending')}
        />
        <KPICard
          title="Completed"
          value={taskKpis.completed}
          subtitle={`${taskKpis.progressPercent}% completion rate`}
          icon={KPIIcons.checkCircle}
          color="#22C55E"
          delay={0.4}
          isActive={filter === 'completed'}
          onClick={() => handleKPIClick('completed')}
        />
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tasks... (press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#0B1220] border border-white/[0.04] rounded-lg text-sm text-white placeholder-[#475569] focus:border-[#38BDF8]/50 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Quick Add Input */}
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <input
              ref={quickAddInputRef}
              type="text"
              placeholder="Quick add task... (Enter to save)"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickAddTitle.trim()) {
                  handleQuickAdd();
                }
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B1220] border border-white/[0.04] rounded-lg text-sm text-white placeholder-[#475569] focus:border-[#22C55E]/50 focus:outline-none"
            />
          </div>

          {/* Keyboard Hints */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-[#475569]">
            <span className="px-1.5 py-0.5 bg-[#1E293B] rounded">N</span>
            <span>New</span>
            <span className="px-1.5 py-0.5 bg-[#1E293B] rounded">/</span>
            <span>Search</span>
            <span className="px-1.5 py-0.5 bg-[#1E293B] rounded">Esc</span>
            <span>Close</span>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedTasks.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-lg"
          >
            <span className="text-sm text-[#38BDF8] font-medium">{selectedTasks.size} selected</span>
            <div className="flex-1" />
            <button
              onClick={() => handleBulkStatusChange('completed')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22C55E] text-white text-xs font-medium rounded-lg hover:bg-[#22C55E]/90 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Mark Complete
            </button>
            <button
              onClick={() => handleBulkStatusChange('pending')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#64748B] text-white text-xs font-medium rounded-lg hover:bg-[#64748B]/90 transition-colors"
            >
              Mark Pending
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-500/90 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
            <button
              onClick={() => setSelectedTasks(new Set())}
              className="px-3 py-1.5 text-[#64748B] hover:text-white text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Toggle & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#0B1220] rounded-lg p-1 border border-white/[0.04]">
          {[
            { key: 'byContract', label: 'By Contract', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
            { key: 'byBundle', label: 'By Bundle', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
            { key: 'byDueDate', label: 'By Due Date', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { key: 'list', label: 'List', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
            { key: 'board', label: 'Board', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
          ].map(view => (
            <button
              key={view.key}
              onClick={() => setViewMode(view.key as ViewMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === view.key
                  ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                  : 'text-[#64748B] hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={view.icon} />
              </svg>
              {view.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="bg-[#0B1220] border border-white/[0.04] rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="dueDate">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Recently Created</option>
            <option value="contract">Sort: Contract</option>
            <option value="status">Sort: Status</option>
          </select>

          {/* Completed/Incomplete Toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              showCompleted
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:text-white'
            }`}
          >
            {showCompleted ? 'Completed' : 'Incomplete'}
          </button>

          {/* Filter Dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterMode)}
            className="bg-[#0B1220] border border-white/[0.04] rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Tasks</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="myTasks">Assigned Tasks</option>
          </select>

          {/* Select All Button (for list view) */}
          {viewMode === 'list' && (
            <button
              onClick={selectAllTasks}
              className="flex items-center gap-2 px-3 py-2 text-[#64748B] hover:text-white text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {selectedTasks.size === filteredTasks.length && filteredTasks.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          )}

          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#38BDF8] text-[#0B1220] font-medium text-sm rounded-lg hover:bg-[#38BDF8]/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      <AnimatePresence>
        {showAddTask && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#111827] rounded-xl border border-white/[0.04] p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4">New Task</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="col-span-2 bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#475569]"
                autoFocus
              />
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#64748B] mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newTask.description || ''}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Add notes or additional details about this task..."
                  rows={3}
                  maxLength={5000}
                  className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50 resize-y"
                />
                <div className="mt-1 text-xs text-[#475569] text-right">
                  {(newTask.description || '').length} / 5000
                </div>
              </div>
              <SearchableBundleOrContractSelect
                contracts={unbundledContracts}
                bundles={bundles}
                value={
                  newTask.bundleId
                    ? { type: 'bundle', id: newTask.bundleId, name: newTask.bundleName || '' }
                    : newTask.contractSalesforceId
                    ? { type: 'contract', id: newTask.contractSalesforceId, name: contracts.find(c => c.salesforceId === newTask.contractSalesforceId)?.name || '' }
                    : null
                }
                onChange={(selection) => {
                  if (!selection || selection.id === '') {
                    setNewTask({ ...newTask, contractSalesforceId: '', contractName: undefined, bundleId: undefined, bundleName: undefined });
                  } else if (selection.type === 'bundle') {
                    setNewTask({ ...newTask, contractSalesforceId: '', contractName: undefined, bundleId: selection.id, bundleName: selection.name });
                  } else {
                    const contract = contracts.find(c => c.salesforceId === selection.id);
                    setNewTask({ ...newTask, contractSalesforceId: selection.id, contractName: contract?.name, bundleId: undefined, bundleName: undefined });
                  }
                }}
                placeholder="Link to contract or bundle..."
              />
              <div
                className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-sm cursor-pointer relative"
                onClick={(e) => {
                  const input = e.currentTarget.querySelector('input');
                  input?.showPicker?.();
                }}
              >
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <span className={newTask.dueDate ? 'text-white' : 'text-[#475569]'}>
                  {newTask.dueDate ? new Date(newTask.dueDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Due date...'}
                </span>
              </div>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' })}
                className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setShowAddTask(false)} className="px-4 py-2 text-[#64748B] hover:text-white text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={handleAddTask} className="px-6 py-2 bg-[#22C55E] text-white font-medium text-sm rounded-lg hover:bg-[#22C55E]/90 transition-colors">
                  Create Task
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setEditingTask(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111827] rounded-xl border border-white/[0.08] p-6 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Edit Task</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Title</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Notes (Optional)</label>
                  <textarea
                    value={editingTask.description || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    placeholder="Add notes or additional details about this task..."
                    rows={3}
                    maxLength={5000}
                    className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50 resize-y"
                  />
                  <div className="mt-1 text-xs text-[#475569] text-right">
                    {(editingTask.description || '').length} / 5000
                  </div>
                </div>
                <div>
                  <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Contract or Bundle</label>
                  <SearchableBundleOrContractSelect
                    contracts={contracts}
                    bundles={bundles}
                    value={
                      editingTask.bundle_id
                        ? { type: 'bundle', id: editingTask.bundle_id, name: editingTask.bundle_name || '' }
                        : editingTask.contract_salesforce_id
                        ? { type: 'contract', id: editingTask.contract_salesforce_id, name: contracts.find(c => c.salesforceId === editingTask.contract_salesforce_id)?.name || '' }
                        : null
                    }
                    onChange={(selection) => {
                      if (!selection || selection.id === '') {
                        setEditingTask({ ...editingTask, contract_salesforce_id: undefined, bundle_id: undefined, bundle_name: undefined });
                      } else if (selection.type === 'bundle') {
                        setEditingTask({ ...editingTask, contract_salesforce_id: undefined, bundle_id: selection.id, bundle_name: selection.name });
                      } else {
                        setEditingTask({ ...editingTask, contract_salesforce_id: selection.id, bundle_id: undefined, bundle_name: undefined });
                      }
                    }}
                    placeholder="Link to contract or bundle..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Due Date</label>
                    <div
                      className="bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-sm cursor-pointer relative"
                      onClick={(e) => {
                        const input = e.currentTarget.querySelector('input');
                        input?.showPicker?.();
                      }}
                    >
                      <input
                        type="date"
                        value={editingTask.due_date || ''}
                        onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className={editingTask.due_date ? 'text-white' : 'text-[#475569]'}>
                        {editingTask.due_date ? new Date(editingTask.due_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select due date...'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Status</label>
                    <select
                      value={editingTask.status}
                      onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value as Task['status'] })}
                      className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[#64748B] text-xs uppercase tracking-wider mb-2">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as Task['priority'] })}
                    className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-[#64748B] hover:text-white text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={handleUpdateTask} className="px-6 py-2 bg-[#38BDF8] text-[#0B1220] font-medium text-sm rounded-lg hover:bg-[#38BDF8]/90 transition-colors">
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Views */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#111827] rounded-xl border border-white/[0.04] overflow-hidden"
      >
        {/* By Contract View */}
        {viewMode === 'byContract' && (
          <div className="divide-y divide-white/[0.04]">
            {tasksByContract.length > 0 ? (
              tasksByContract.map(({ contractName, tasks: contractTasks, overdueCount, activeCount, totalCount }) => {
                // Look up contract to get type
                const linkedContract = contracts.find(c => c.name === contractName);
                const contractType = linkedContract?.contractType?.join(', ') || '';

                return (
                <div key={contractName}>
                  <button
                    onClick={() => toggleContractExpanded(contractName)}
                    className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 text-[#64748B] transition-transform ${expandedContracts.has(contractName) ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 text-left">
                      <span className="font-medium text-white">{contractName}</span>
                      {contractType && (
                        <span className="text-[#64748B] text-sm ml-2">• {contractType}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {overdueCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                          ⚠ {overdueCount}
                        </span>
                      )}
                      <span className="text-xs text-[#64748B] bg-white/[0.04] px-2 py-1 rounded">
                        {activeCount} active / {totalCount} total
                      </span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedContracts.has(contractName) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-4 space-y-2 pl-12">
                          {contractTasks.map((task, idx) => (
                            <TaskRow key={task.id} task={task} index={idx} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );})
            ) : (
              <div className="text-center py-16 text-[#475569]">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm">No tasks yet</p>
                <p className="text-xs mt-1">Click "Add Task" to create your first task</p>
              </div>
            )}
          </div>
        )}

        {/* By Bundle View */}
        {viewMode === 'byBundle' && (
          <div className="divide-y divide-white/[0.04]">
            {tasksByBundle.length > 0 ? (
              tasksByBundle.map(({ groupName, isBundle, tasks: groupTasks, overdueCount, activeCount, totalCount }) => {
                return (
                <div key={groupName}>
                  <button
                    onClick={() => toggleContractExpanded(groupName)}
                    className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 text-[#64748B] transition-transform ${expandedContracts.has(groupName) ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 text-left flex items-center gap-2">
                      {isBundle && (
                        <span className="text-purple-400 text-lg">📦</span>
                      )}
                      <span className={`font-medium ${isBundle ? 'text-purple-400' : 'text-white'}`}>
                        {groupName}
                      </span>
                      {isBundle && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-medium uppercase">
                          Bundle
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {overdueCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                          ⚠ {overdueCount}
                        </span>
                      )}
                      <span className="text-xs text-[#64748B] bg-white/[0.04] px-2 py-1 rounded">
                        {activeCount} active / {totalCount} total
                      </span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedContracts.has(groupName) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-4 space-y-2 pl-12">
                          {groupTasks.map((task, idx) => (
                            <TaskRow key={task.id} task={task} index={idx} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );})
            ) : (
              <div className="text-center py-16 text-[#475569]">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm">No tasks yet</p>
                <p className="text-xs mt-1">Click "Add Task" to create your first task</p>
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="p-6 space-y-2">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, idx) => (
                <TaskRow key={task.id} task={task} showContract index={idx} showSelection />
              ))
            ) : (
              <div className="text-center py-12 text-[#475569]">
                <p className="text-sm">{searchQuery ? 'No tasks matching your search' : 'No tasks found'}</p>
              </div>
            )}
          </div>
        )}

        {/* By Due Date View */}
        {viewMode === 'byDueDate' && (
          <div className="divide-y divide-white/[0.04]">
            {[
              { key: 'overdue', title: 'Overdue', tasks: tasksByDueDate.overdue, color: '#EF4444', icon: '⚠' },
              { key: 'today', title: 'Today', tasks: tasksByDueDate.today, color: '#F59E0B', icon: '📅' },
              { key: 'tomorrow', title: 'Tomorrow', tasks: tasksByDueDate.tomorrow, color: '#38BDF8', icon: '📆' },
              { key: 'thisWeek', title: 'This Week', tasks: tasksByDueDate.thisWeek, color: '#8B5CF6', icon: '📋' },
              { key: 'later', title: 'Later', tasks: tasksByDueDate.later, color: '#64748B', icon: '📁' },
              { key: 'noDueDate', title: 'No Due Date', tasks: tasksByDueDate.noDueDate, color: '#475569', icon: '❓' },
            ].filter(group => group.tasks.length > 0).map((group) => (
              <div key={group.key}>
                <button
                  onClick={() => toggleDateGroupExpanded(group.key)}
                  className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <svg
                    className={`w-4 h-4 text-[#64748B] transition-transform ${expandedDateGroups.has(group.key) ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-lg">{group.icon}</span>
                  <span className="font-medium text-white flex-1 text-left">{group.title}</span>
                  <span
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{ backgroundColor: `${group.color}20`, color: group.color }}
                  >
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </button>
                <AnimatePresence>
                  {expandedDateGroups.has(group.key) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-2 pl-16">
                        {group.tasks.map((task, idx) => (
                          <TaskRow key={task.id} task={task} showContract index={idx} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {Object.values(tasksByDueDate).every(arr => arr.length === 0) && (
              <div className="text-center py-16 text-[#475569]">
                <p className="text-sm">No active tasks</p>
              </div>
            )}
          </div>
        )}

        {/* Board View (Kanban) with Drag & Drop */}
        {viewMode === 'board' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
              {[
                { key: 'pending', status: 'pending' as const, title: 'To Do', tasks: tasksByStatus.pending, color: '#64748B' },
                { key: 'in_progress', status: 'in_progress' as const, title: 'In Progress', tasks: tasksByStatus.inProgress, color: '#38BDF8' },
                { key: 'completed', status: 'completed' as const, title: 'Done', tasks: tasksByStatus.completed, color: '#22C55E' },
              ].map((column) => (
                <div
                  key={column.key}
                  id={`column-${column.key}`}
                  className="min-h-[400px]"
                >
                  <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2 sticky top-0 bg-[#111827] z-10">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                    <span className="text-sm font-medium text-white">{column.title}</span>
                    <span className="text-xs text-[#64748B] bg-white/[0.04] px-1.5 py-0.5 rounded">
                      {column.tasks.length}
                    </span>
                  </div>
                  <SortableContext
                    items={column.tasks.map(t => t.id!)}
                    strategy={verticalListSortingStrategy}
                    id={`sortable-${column.key}`}
                  >
                    <div className="p-3 space-y-2 min-h-[300px]">
                      {column.tasks.map((task, idx) => (
                        <DraggableTaskCard
                          key={task.id}
                          task={task}
                          columnStatus={column.status}
                          index={idx}
                          onEdit={setEditingTask}
                          onDelete={deleteTask}
                          onOpenContractDetail={onOpenContractDetail}
                          contracts={contracts}
                          highlightedTaskId={highlightedTaskId}
                        />
                      ))}
                      {column.tasks.length === 0 && (
                        <div
                          id={`column-${column.key}`}
                          className="text-center py-8 text-[#475569] text-xs border-2 border-dashed border-white/[0.04] rounded-lg"
                        >
                          Drop tasks here
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              ))}
            </div>
            <DragOverlay>
              {activeTask ? (
                <div className="p-3 rounded-lg border border-[#38BDF8]/50 bg-[#0B1220] shadow-lg shadow-[#38BDF8]/20 rotate-3 cursor-grabbing">
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-white font-medium flex-1">{activeTask.title}</p>
                    {activeTask.is_auto_generated && (
                      <span className="text-[8px] px-1 py-0.5 bg-[#38BDF8]/10 text-[#38BDF8] rounded flex-shrink-0">
                        AUTO
                      </span>
                    )}
                  </div>
                  {activeTask.contract_name && (
                    <p className="text-xs text-[#38BDF8] mt-1 truncate">{activeTask.contract_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {activeTask.due_date && (
                      <span className="text-[10px] text-[#64748B]">
                        {new Date(activeTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                      activeTask.priority === 'urgent' ? 'bg-red-500/15 text-red-400' :
                      activeTask.priority === 'high' ? 'bg-orange-500/15 text-orange-400' :
                      activeTask.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-[#475569]/20 text-[#64748B]'
                    }`}>
                      {activeTask.priority}
                    </span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </motion.div>
    </div>
  );
}
