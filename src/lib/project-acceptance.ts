/**
 * Project Acceptance Tracking
 * Matches Asana projects with DocuSign acceptance envelopes
 * to track PM compliance in sending acceptance documents
 */

import { AsanaTask } from './asana';
import { DocuSignEnvelope, extractCustomerFromSubject } from './docusign';

// Status for a project's acceptance document
export interface ProjectAcceptanceStatus {
  // From Asana
  projectName: string;
  projectType: 'project' | 'mcc';
  customerName: string;
  completedDate: string;
  asanaTaskId: string;

  // From DocuSign matching
  acceptanceSent: boolean;
  acceptanceSentDate?: string;
  acceptanceStatus?: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  envelopeId?: string;
  envelopeSubject?: string;

  // Calculated
  daysSinceCompletion: number;
  daysSinceAcceptanceSent?: number;
  isOverdue: boolean; // True if completed > 7 days ago with no acceptance sent
}

// Summary stats for PM compliance
export interface AcceptanceComplianceStats {
  totalReadyForAcceptance: number;
  acceptanceSent: number;
  acceptancePending: number;
  acceptanceMissing: number;
  acceptanceCompleted: number;
  percentSent: number;
  percentCompleted: number;
  avgDaysToSendAcceptance: number;
}

/**
 * Check if an Asana task is ready for acceptance
 * - Has "confirmed" tag AND due date is in the past
 */
export function isReadyForAcceptance(task: AsanaTask): boolean {
  const hasConfirmedTag = task.tags?.some(t =>
    t?.name?.toLowerCase() === 'confirmed'
  );
  const isPastDue = task.due_on && new Date(task.due_on) < new Date();
  return !!(hasConfirmedTag && isPastDue);
}

/**
 * Extract customer name from Asana task
 * Assumes task name contains the customer/project name
 */
export function extractCustomerFromTask(task: AsanaTask): string {
  // Task name is typically the customer/project name
  return task.name.trim();
}

/**
 * Determine project type from Asana task
 * Based on which project it belongs to
 */
export function getProjectType(task: AsanaTask, mccProjectId?: string): 'project' | 'mcc' {
  // Check if task is in MCC project
  const isInMcc = task.projects?.some(p => p.gid === mccProjectId) ||
    task.memberships?.some(m => m.project.gid === mccProjectId);
  return isInMcc ? 'mcc' : 'project';
}

/**
 * Find matching DocuSign envelope for an Asana task
 * Matches by customer name in the envelope subject
 */
export function findMatchingEnvelope(
  task: AsanaTask,
  envelopes: DocuSignEnvelope[],
  projectType: 'project' | 'mcc'
): DocuSignEnvelope | null {
  const customerName = extractCustomerFromTask(task).toLowerCase();

  // Find envelope that matches customer name and type
  return envelopes.find(env => {
    const extracted = extractCustomerFromSubject(env.emailSubject);
    if (!extracted) return false;

    // Must match both customer name and type
    if (extracted.type !== projectType) return false;

    // Fuzzy match on customer name
    const envCustomer = extracted.customer.toLowerCase();
    return (
      envCustomer.includes(customerName) ||
      customerName.includes(envCustomer) ||
      // Also try matching without common suffixes
      normalizeCustomerName(envCustomer) === normalizeCustomerName(customerName)
    );
  }) || null;
}

/**
 * Normalize customer name for matching
 * Removes common suffixes and standardizes format
 */
function normalizeCustomerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(inc|llc|corp|company|co|ltd|water|district|authority|city of|town of|county of)\.?$/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string | Date, date2: string | Date = new Date()): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Match Asana tasks with DocuSign envelopes
 * Returns combined status for each project
 */
export function matchProjectsWithAcceptance(
  tasks: AsanaTask[],
  envelopes: DocuSignEnvelope[],
  options: {
    mccProjectId?: string;
    overdueThresholdDays?: number;
  } = {}
): ProjectAcceptanceStatus[] {
  const { mccProjectId, overdueThresholdDays = 7 } = options;
  const today = new Date();

  // Filter to only tasks ready for acceptance
  const readyTasks = tasks.filter(isReadyForAcceptance);

  return readyTasks.map(task => {
    const projectType = getProjectType(task, mccProjectId);
    const customerName = extractCustomerFromTask(task);
    const completedDate = task.due_on || task.completed_at || today.toISOString();
    const daysSinceCompletion = daysBetween(completedDate, today);

    // Find matching envelope
    const envelope = findMatchingEnvelope(task, envelopes, projectType);

    const status: ProjectAcceptanceStatus = {
      projectName: task.name,
      projectType,
      customerName,
      completedDate,
      asanaTaskId: task.gid,
      acceptanceSent: !!envelope,
      daysSinceCompletion,
      isOverdue: !envelope && daysSinceCompletion > overdueThresholdDays,
    };

    if (envelope) {
      status.envelopeId = envelope.envelopeId;
      status.envelopeSubject = envelope.emailSubject;
      status.acceptanceStatus = envelope.status;
      status.acceptanceSentDate = envelope.sentDateTime;

      if (envelope.sentDateTime) {
        status.daysSinceAcceptanceSent = daysBetween(envelope.sentDateTime, today);
      }
    }

    return status;
  });
}

/**
 * Calculate compliance statistics
 */
export function calculateComplianceStats(statuses: ProjectAcceptanceStatus[]): AcceptanceComplianceStats {
  const total = statuses.length;
  const sent = statuses.filter(s => s.acceptanceSent).length;
  const completed = statuses.filter(s =>
    s.acceptanceStatus === 'completed' || s.acceptanceStatus === 'signed'
  ).length;
  const missing = statuses.filter(s => !s.acceptanceSent).length;
  const pending = sent - completed;

  // Calculate average days to send acceptance (for those that were sent)
  const sentStatuses = statuses.filter(s => s.acceptanceSent && s.acceptanceSentDate && s.completedDate);
  const avgDays = sentStatuses.length > 0
    ? sentStatuses.reduce((sum, s) => sum + daysBetween(s.completedDate, s.acceptanceSentDate!), 0) / sentStatuses.length
    : 0;

  return {
    totalReadyForAcceptance: total,
    acceptanceSent: sent,
    acceptancePending: pending,
    acceptanceMissing: missing,
    acceptanceCompleted: completed,
    percentSent: total > 0 ? Math.round((sent / total) * 100) : 0,
    percentCompleted: total > 0 ? Math.round((completed / total) * 100) : 0,
    avgDaysToSendAcceptance: Math.round(avgDays),
  };
}

/**
 * Sort statuses for display
 * Overdue first, then by days since completion (descending)
 */
export function sortByPriority(statuses: ProjectAcceptanceStatus[]): ProjectAcceptanceStatus[] {
  return [...statuses].sort((a, b) => {
    // Overdue items first
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    // Then by missing acceptance
    if (!a.acceptanceSent && b.acceptanceSent) return -1;
    if (a.acceptanceSent && !b.acceptanceSent) return 1;

    // Then by days since completion (longest first)
    return b.daysSinceCompletion - a.daysSinceCompletion;
  });
}
