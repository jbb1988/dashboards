// Contract Command Center - Unified Interface
// A modern, three-panel workspace that replaces the fragmented tab-based UI

export { default as ContractCommandCenter } from './ContractCommandCenter';
export { default as ContractLeftPanel } from './ContractLeftPanel';
export { default as ContractCenterContent } from './ContractCenterContent';
export { default as ContractContextPanel } from './ContractContextPanel';

// Re-export types
export type {
  Contract,
  RiskScores,
  ReviewResult,
  ReviewHistory,
  Approval,
  PlaybookOption,
  CenterContentMode,
  ContextPanelTab,
  SelectedItem,
} from './ContractCommandCenter';
