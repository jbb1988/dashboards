'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Project {
  customer_name: string;
  project_type: string;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_profit_pct: number;
  transaction_count: number;
  gp_variance?: number;
}

interface TypeBreakdown {
  project_type: string;
  total_revenue: number;
  gross_profit_pct: number;
}

interface MonthlyData {
  year: number;
  month: number;
  revenue: number;
}

interface AIInsightsPanelProps {
  projects: Project[];
  types: TypeBreakdown[];
  monthly: MonthlyData[];
  totalRevenue: number;
  grossProfitPct: number;
}

interface Insight {
  type: 'highlight' | 'positive' | 'warning' | 'negative' | 'info';
  icon: string;
  title: string;
  text: string;
  value?: string;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function generateInsights(props: AIInsightsPanelProps): Insight[] {
  const { projects, types, monthly, totalRevenue, grossProfitPct } = props;
  const insights: Insight[] = [];

  if (!projects || projects.length === 0) {
    return [{
      type: 'info',
      icon: '📊',
      title: 'No Data',
      text: 'Sync data from NetSuite to see insights'
    }];
  }

  // 1. Top customer by revenue
  const sortedByRevenue = [...projects].sort((a, b) => b.total_revenue - a.total_revenue);
  if (sortedByRevenue[0]) {
    insights.push({
      type: 'highlight',
      icon: '🏆',
      title: 'Top Customer',
      text: sortedByRevenue[0].customer_name,
      value: formatCurrency(sortedByRevenue[0].total_revenue)
    });
  }

  // 2. Best margin project type
  if (types && types.length > 0) {
    const sortedTypes = [...types].sort((a, b) => b.gross_profit_pct - a.gross_profit_pct);
    const bestType = sortedTypes[0];
    if (bestType && bestType.gross_profit_pct > 0) {
      insights.push({
        type: 'positive',
        icon: '📈',
        title: 'Best Margin',
        text: `${bestType.project_type} has highest GPM`,
        value: `${bestType.gross_profit_pct.toFixed(1)}%`
      });
    }
  }

  // 3. At-risk projects count
  const atRiskProjects = projects.filter(p => p.gross_profit_pct < 50);
  if (atRiskProjects.length > 0) {
    const worstProject = atRiskProjects.sort((a, b) => a.gross_profit_pct - b.gross_profit_pct)[0];
    insights.push({
      type: 'warning',
      icon: '⚠️',
      title: 'At Risk',
      text: `${atRiskProjects.length} project${atRiskProjects.length > 1 ? 's' : ''} with GPM below 50%`,
      value: worstProject ? `${worstProject.customer_name}: ${worstProject.gross_profit_pct.toFixed(0)}%` : undefined
    });
  } else {
    insights.push({
      type: 'positive',
      icon: '✅',
      title: 'All Healthy',
      text: 'No projects at risk (GPM > 50%)'
    });
  }

  // 4. YoY comparison
  if (monthly && monthly.length > 12) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Calculate YTD for current year and last year
    const currentYearData = monthly.filter(m => m.year === currentYear && m.month <= currentMonth);
    const lastYearData = monthly.filter(m => m.year === currentYear - 1 && m.month <= currentMonth);

    const currentYTD = currentYearData.reduce((sum, m) => sum + m.revenue, 0);
    const lastYTD = lastYearData.reduce((sum, m) => sum + m.revenue, 0);

    if (lastYTD > 0) {
      const yoyChange = ((currentYTD - lastYTD) / lastYTD) * 100;
      insights.push({
        type: yoyChange >= 0 ? 'positive' : 'negative',
        icon: yoyChange >= 0 ? '🚀' : '📉',
        title: 'YoY Change',
        text: `YTD revenue ${yoyChange >= 0 ? 'up' : 'down'} vs last year`,
        value: `${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(0)}%`
      });
    }
  }

  // 5. Revenue concentration
  if (sortedByRevenue.length >= 3 && totalRevenue > 0) {
    const top3Revenue = sortedByRevenue.slice(0, 3).reduce((sum, p) => sum + p.total_revenue, 0);
    const top3Pct = (top3Revenue / totalRevenue) * 100;

    if (top3Pct > 50) {
      insights.push({
        type: 'info',
        icon: '📊',
        title: 'Concentration',
        text: `Top 3 customers = ${top3Pct.toFixed(0)}% of revenue`,
        value: formatCurrency(top3Revenue)
      });
    }
  }

  // 6. Best performing project (highest GP)
  const bestGPProject = [...projects].sort((a, b) => b.gross_profit - a.gross_profit)[0];
  if (bestGPProject && bestGPProject.gross_profit > 100000) {
    insights.push({
      type: 'highlight',
      icon: '💰',
      title: 'Top Profit',
      text: bestGPProject.customer_name,
      value: formatCurrency(bestGPProject.gross_profit)
    });
  }

  return insights.slice(0, 6); // Limit to 6 insights
}

const typeColors: Record<Insight['type'], { bg: string; border: string; icon: string }> = {
  highlight: { bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)', icon: '#38BDF8' },
  positive: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', icon: '#22C55E' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', icon: '#F59E0B' },
  negative: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', icon: '#EF4444' },
  info: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)', icon: '#8B5CF6' },
};

export default function AIInsightsPanel(props: AIInsightsPanelProps) {
  const insights = useMemo(() => generateInsights(props), [props]);

  return (
    <div className="rounded-xl bg-[#111827] border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.2)] p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#38BDF8] flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-[11px] font-semibold text-[#8B5CF6] uppercase tracking-[0.08em]">
          AI Insights
        </h3>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => {
          const colors = typeColors[insight.type];
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.2 }}
              className="p-3 rounded-lg border"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border
              }}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">{insight.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: colors.icon }}>
                      {insight.title}
                    </span>
                    {insight.value && (
                      <span className="text-[12px] font-bold text-white">
                        {insight.value}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed truncate">
                    {insight.text}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
