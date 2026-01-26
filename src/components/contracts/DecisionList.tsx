'use client';

import { useMemo } from 'react';
import DecisionItem, { DecisionItemData } from './DecisionItem';

interface RiskScores {
  summary: {
    high: number;
    medium: number;
    low: number;
  };
  sections: Array<{
    sectionTitle: string;
    riskLevel: 'high' | 'medium' | 'low';
    summary?: string;
  }>;
}

interface DecisionListProps {
  redlinedText: string;
  riskScores?: RiskScores | null;
  summaries?: string[];
  onApplyAll?: () => void;
  onApplyChanges?: (itemId: string) => void;
  readOnly?: boolean;
  contractName?: string;
  onRefreshFromWord?: () => void;
  refreshingFromWord?: boolean;
}

/**
 * Count the number of changes (del/ins tags) in HTML content
 */
function countChanges(html: string): number {
  const delMatches = html.match(/<del[^>]*>|<span[^>]*data-ai-strike[^>]*>/gi) || [];
  const insMatches = html.match(/<ins[^>]*>|<span[^>]*data-ai-insert[^>]*>/gi) || [];
  return delMatches.length + insMatches.length;
}

/**
 * Parse redlined text into decision items based on risk sections
 * This is a simplified approach - in a full implementation, you'd want
 * the AI to return structured data with sections mapped to content
 */
function parseRedlinesToItems(
  redlinedText: string,
  riskScores: RiskScores | null | undefined,
  summaries: string[] | undefined
): DecisionItemData[] {
  const items: DecisionItemData[] = [];

  // If we have risk sections, create items for each
  if (riskScores?.sections && riskScores.sections.length > 0) {
    riskScores.sections.forEach((section, index) => {
      // Find a matching summary if available
      const summaryMatch = summaries?.find(s =>
        s.toLowerCase().includes(section.sectionTitle.toLowerCase())
      );

      items.push({
        id: `section-${index}`,
        title: section.sectionTitle,
        summary: section.summary || summaryMatch || 'Review suggested changes',
        riskLevel: section.riskLevel,
        changeCount: 0, // Will be updated below
        redlineHtml: '', // Will be populated if we can match content
      });
    });

    // If we have items but no matched content, put all redlines in the first matching item
    if (items.length > 0 && redlinedText) {
      const changeCount = countChanges(redlinedText);
      // Distribute evenly or put all in first high-risk item
      const highRiskItem = items.find(i => i.riskLevel === 'high');
      if (highRiskItem) {
        highRiskItem.redlineHtml = redlinedText;
        highRiskItem.changeCount = changeCount;
      } else {
        items[0].redlineHtml = redlinedText;
        items[0].changeCount = changeCount;
      }
    }
  } else {
    // No risk sections - create a single item with all content
    const changeCount = countChanges(redlinedText);
    if (changeCount > 0 || redlinedText.trim()) {
      items.push({
        id: 'all-changes',
        title: 'Contract Changes',
        summary: 'Review all suggested modifications',
        riskLevel: 'medium',
        changeCount,
        redlineHtml: redlinedText,
      });
    }
  }

  // Sort by risk level (high first)
  const riskOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  return items;
}

export default function DecisionList({
  redlinedText,
  riskScores,
  summaries,
  onApplyAll,
  onApplyChanges,
  readOnly,
  contractName,
  onRefreshFromWord,
  refreshingFromWord,
}: DecisionListProps) {
  const items = useMemo(
    () => parseRedlinesToItems(redlinedText, riskScores, summaries),
    [redlinedText, riskScores, summaries]
  );

  const totalChanges = items.reduce((sum, item) => sum + item.changeCount, 0);
  const hasChanges = totalChanges > 0;

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col bg-[#161B22]">
      {/* Header with primary CTA */}
      <div className="px-6 py-4 border-b border-white/5 bg-[#1E2328]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-[#E6EDF3]">
              {contractName || 'Contract Review'}
            </h2>
            <p className="text-xs text-[#8B949E] mt-0.5">
              {hasChanges ? `${totalChanges} changes across ${items.length} sections` : 'No changes detected'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh from Word - quiet link style */}
            {onRefreshFromWord && (
              <button
                type="button"
                onClick={onRefreshFromWord}
                disabled={refreshingFromWord}
                className="text-xs text-[#58A6FF] hover:text-[#79C0FF] transition-colors disabled:opacity-50"
              >
                {refreshingFromWord ? 'Refreshing...' : 'Refresh from Word'}
              </button>
            )}

            {/* Primary CTA */}
            {!readOnly && hasChanges && onApplyAll && (
              <button
                type="button"
                onClick={onApplyAll}
                className="px-4 py-2 text-sm font-medium bg-[#238636] hover:bg-[#2ea043] text-white rounded transition-colors"
              >
                Apply All Changes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Decision Items */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <DecisionItem
                key={item.id}
                item={item}
                onApplyChanges={onApplyChanges}
                readOnly={readOnly}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-[#238636]/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#3FB950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-[#8B949E]">No changes to review</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer legend - minimal */}
      {hasChanges && (
        <div className="px-6 py-2 border-t border-white/5 bg-[#1E2328]">
          <div className="flex items-center gap-4 text-xs text-[#8B949E]">
            <span className="flex items-center gap-1">
              <span className="text-[#F85149] line-through">removed</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-[#3FB950] underline">added</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
