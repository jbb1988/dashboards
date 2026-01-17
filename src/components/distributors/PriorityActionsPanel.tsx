'use client';

import { useState } from 'react';

interface PriorityAction {
  id: string;
  category: 'revenue' | 'engagement' | 'expansion' | 'retention' | 'margin';
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  metrics: {
    current: number;
    target: number;
    opportunity: number;
  };
}

interface PriorityActionsPanelProps {
  actions: PriorityAction[];
  onCreateTask?: (action: PriorityAction) => void;
}

export default function PriorityActionsPanel({ actions, onCreateTask }: PriorityActionsPanelProps) {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [tasksCreated, setTasksCreated] = useState<Set<string>>(new Set());

  const priorityConfig = {
    critical: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300', icon: '🚨' },
    high: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-300', icon: '⚡' },
    medium: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300', icon: '💡' },
  };

  return (
    <div className="p-6 rounded-xl bg-[#151F2E] border border-white/[0.06]">
      <h2 className="text-lg font-semibold text-white mb-4">Priority Actions</h2>
      <p className="text-sm text-[#64748B] mb-6">
        Top recommendations to improve location performance
      </p>

      <div className="space-y-3">
        {actions.map((action) => {
          const config = priorityConfig[action.priority];
          const isExpanded = expandedAction === action.id;

          return (
            <div
              key={action.id}
              className={`p-4 rounded-lg ${config.bg} border ${config.border} cursor-pointer hover:bg-opacity-80 transition-all`}
              onClick={() => setExpandedAction(isExpanded ? null : action.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className={`text-xs font-semibold ${config.text} uppercase tracking-wider`}>
                      {action.priority} Priority
                    </span>
                    <span className="text-xs text-[#64748B]">•</span>
                    <span className="text-xs text-[#64748B] capitalize">{action.category}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{action.title}</h3>
                  <p className="text-xs text-[#94A3B8]">{action.description}</p>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-[#64748B] mb-1">Impact</div>
                        <div className="text-sm font-medium text-white">{action.impact}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#64748B] mb-1">Effort</div>
                        <div className="text-sm font-medium text-white capitalize">{action.effort}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#64748B] mb-1">Opportunity</div>
                        <div className="text-sm font-medium text-white">
                          ${(action.metrics.opportunity / 1000).toFixed(1)}k
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {onCreateTask && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateTask(action);
                      setTasksCreated(prev => new Set(prev).add(action.id));
                    }}
                    disabled={tasksCreated.has(action.id)}
                    className={`ml-4 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      tasksCreated.has(action.id)
                        ? 'bg-green-500/20 text-green-300 border-green-500/30 cursor-not-allowed'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30'
                    }`}
                  >
                    {tasksCreated.has(action.id) ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Task Created
                      </span>
                    ) : (
                      'Create Task'
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
