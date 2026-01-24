/**
 * ProjectBrowser Component
 * Tabbed interface for browsing projects with categorization and year grouping
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { MetricBadge } from './MetricBadge';

interface ProjectSummary {
  name: string;
  years: number[];
  latestYear: number;
  latestMonth: number | null;
  projectType: string;
  recentRevenue: number;
  recentGPM: number;
  recentVariance: number;
  isAtRisk: boolean;
  isHighValue: boolean;
  isRecent: boolean;
  hasData: boolean;
  multipleEngagements: boolean;
  engagementCount: number;
}

interface ProjectBrowserProps {
  onSelectProject: (project: string, year?: number) => void;
}

type TabType = 'recent' | 'all' | 'mcc' | 'at-risk' | 'high-value';

export default function ProjectBrowser({ onSelectProject }: ProjectBrowserProps) {
  const [activeTab, setActiveTab] = useState<TabType>('recent');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Fetch projects from API
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/closeout/projects');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch projects');
      }

      setProjects(data.projects || []);

      // Auto-expand recent years (2024+)
      const recentYears = new Set<number>();
      data.projects?.forEach((p: ProjectSummary) => {
        if (p.latestYear >= 2024) {
          recentYears.add(p.latestYear);
        }
      });
      setExpandedYears(recentYears);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Filter projects based on active tab
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply tab filter
    switch (activeTab) {
      case 'recent':
        filtered = filtered.filter(p => p.isRecent);
        break;
      case 'mcc':
        filtered = filtered.filter(p => p.projectType === 'MCC');
        break;
      case 'at-risk':
        filtered = filtered.filter(p => p.isAtRisk);
        break;
      case 'high-value':
        filtered = filtered.filter(p => p.isHighValue);
        break;
      case 'all':
        // No filter
        break;
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [projects, activeTab, searchQuery]);

  // Group projects by year
  const projectsByYear = useMemo(() => {
    const grouped = new Map<number, ProjectSummary[]>();

    filteredProjects.forEach(project => {
      const year = project.latestYear;
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }
      grouped.get(year)!.push(project);
    });

    // Sort projects within each year by revenue (high to low)
    grouped.forEach((projects, year) => {
      projects.sort((a, b) => b.recentRevenue - a.recentRevenue);
    });

    return grouped;
  }, [filteredProjects]);

  // Get sorted years (most recent first)
  const sortedYears = useMemo(() => {
    return Array.from(projectsByYear.keys()).sort((a, b) => b - a);
  }, [projectsByYear]);

  const toggleYear = (year: number) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return '$0';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatMonth = (month: number | null, year: number) => {
    if (!month) return `${year}`;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${year}`;
  };

  const getVarianceColor = (variance: number) => {
    if (variance < -10000) return '#EF4444'; // red-500
    if (variance < 0) return '#F59E0B'; // amber-500
    return '#10B981'; // green-500
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-pulse text-gray-400">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-400">Error: {error}</div>
        <button
          onClick={fetchProjects}
          className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-gray-600"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recent'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Recent
          <span className="ml-2 text-xs opacity-60">
            ({projects.filter(p => p.isRecent).length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          All Years
          <span className="ml-2 text-xs opacity-60">({projects.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('mcc')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mcc'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          MCC
          <span className="ml-2 text-xs opacity-60">
            ({projects.filter(p => p.projectType === 'MCC').length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('at-risk')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'at-risk'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          At-Risk
          <span className="ml-2 text-xs opacity-60">
            ({projects.filter(p => p.isAtRisk).length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('high-value')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'high-value'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          High-Value
          <span className="ml-2 text-xs opacity-60">
            ({projects.filter(p => p.isHighValue).length})
          </span>
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchQuery
              ? `No projects found matching "${searchQuery}"`
              : `No projects in this category. Try other tabs.`}
          </div>
        ) : (
          sortedYears.map(year => {
            const yearProjects = projectsByYear.get(year) || [];
            const isExpanded = expandedYears.has(year);

            return (
              <div key={year} className="space-y-2">
                {/* Year Header */}
                <button
                  onClick={() => toggleYear(year)}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-semibold text-gray-300">{year}</span>
                  <span className="text-xs text-gray-500">
                    ({yearProjects.length} {yearProjects.length === 1 ? 'project' : 'projects'})
                  </span>
                </button>

                {/* Projects */}
                {isExpanded && (
                  <div className="space-y-2 pl-6">
                    {yearProjects.map(project => (
                      <div
                        key={`${project.name}-${year}`}
                        onClick={() => onSelectProject(project.name, year)}
                        className="flex items-center justify-between p-3 bg-gray-800/30 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors group"
                      >
                        {/* Left: Status + Name */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <StatusBadge
                            isAtRisk={project.isAtRisk}
                            isHighValue={project.isHighValue}
                            isRecent={project.isRecent && !project.isAtRisk && !project.isHighValue}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
                                {project.name}
                              </h4>
                              {project.multipleEngagements && (
                                <span
                                  className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-medium rounded-full whitespace-nowrap"
                                  title={`${project.engagementCount} separate engagements - use Month/Type filters to view individually`}
                                >
                                  {project.engagementCount}x
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {project.projectType && <span>{project.projectType}</span>}
                              {project.projectType && <span>•</span>}
                              <span>{formatMonth(project.latestMonth, project.latestYear)}</span>
                              {project.multipleEngagements && (
                                <span className="text-blue-400">• Multiple entries</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Metrics */}
                        <div className="flex items-center gap-4">
                          <MetricBadge
                            label="Revenue"
                            value={formatCurrency(project.recentRevenue)}
                            color={project.recentRevenue > 500000 ? '#10B981' : '#8FA3BF'}
                          />
                          <MetricBadge
                            label="GPM"
                            value={`${project.recentGPM.toFixed(1)}%`}
                            color={project.recentGPM < 50 ? '#EF4444' : '#10B981'}
                          />
                          <MetricBadge
                            label="Variance"
                            value={formatCurrency(project.recentVariance)}
                            color={getVarianceColor(project.recentVariance)}
                          />
                          {project.years.length > 1 && (
                            <div className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-400">
                              {Math.min(...project.years)}-{Math.max(...project.years)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
