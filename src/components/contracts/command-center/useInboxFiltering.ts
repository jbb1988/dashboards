import { useMemo } from 'react';
import type { Approval, ReviewHistory } from './ContractCommandCenter';

export interface InboxItem {
  id: string;
  type: 'approval' | 'draft' | 'rejection';
  data: Approval | ReviewHistory;
  urgency: 'critical' | 'high' | 'normal';
  timestamp: string;
}

/**
 * Determines if a user is an approver for a given approval
 * (All admins can approve, or the specific approver if assigned)
 */
function isUserApprover(approval: Approval, userEmail: string): boolean {
  // For now, we'll assume all logged-in users can see approvals
  // In production, you'd check if userEmail is an admin or the assigned approver
  return true;
}

/**
 * Checks if a timestamp is within the specified number of hours
 */
function isWithinHours(timestamp: string | undefined, hours: number): boolean {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= hours;
}

/**
 * Custom hook to compute inbox items from approvals and history
 * Returns only items that require user attention
 */
export function useInboxFiltering(
  approvals: Approval[],
  history: ReviewHistory[],
  currentUserEmail: string
) {
  return useMemo(() => {
    const items: InboxItem[] = [];

    // 1. Add pending approvals (if user is an approver)
    approvals
      .filter(a =>
        a.approvalStatus === 'pending' &&
        isUserApprover(a, currentUserEmail)
      )
      .forEach(approval => {
        items.push({
          id: approval.reviewId,
          type: 'approval',
          data: approval,
          urgency: approval.urgency,
          timestamp: approval.submittedAt,
        });
      });

    // 2. Add user's drafts (items created by this user that are still drafts)
    history
      .filter(h =>
        h.status === 'draft' &&
        // Only include if created by current user (or if createdBy is not set, include all)
        (!h.createdBy || h.createdBy === currentUserEmail)
      )
      .forEach(draft => {
        items.push({
          id: draft.id,
          type: 'draft',
          data: draft,
          urgency: 'normal',
          timestamp: draft.createdAt,
        });
      });

    // 3. Add recently rejected items (within 48 hours)
    approvals
      .filter(a =>
        a.approvalStatus === 'rejected' &&
        isWithinHours(a.approvedAt, 48) // approvedAt is also set for rejections
      )
      .forEach(rejection => {
        items.push({
          id: rejection.reviewId,
          type: 'rejection',
          data: rejection,
          urgency: 'high', // Rejections are high priority
          timestamp: rejection.approvedAt || rejection.submittedAt,
        });
      });

    // Sort by urgency (critical > high > normal), then by recency
    const urgencyOrder = { critical: 0, high: 1, normal: 2 };
    items.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;

      // If same urgency, sort by most recent first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return items;
  }, [approvals, history, currentUserEmail]);
}
