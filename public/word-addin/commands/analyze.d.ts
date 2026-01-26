/**
 * MARS Word Add-in Commands
 * Ribbon button command handlers
 */
/**
 * Analyze document command - called from ribbon button
 */
declare function analyzeDocument(event: Office.AddinCommands.Event): Promise<void>;
/**
 * Highlight identified risks in the document
 */
declare function highlightRisks(risks: Array<{
    location?: string;
    severity: string;
}>): Promise<void>;
/**
 * Insert clause at current selection
 */
declare function insertClauseAtSelection(clauseText: string): Promise<void>;
/**
 * Clear all highlights from document
 */
declare function clearHighlights(): Promise<void>;
export { analyzeDocument, insertClauseAtSelection, clearHighlights, highlightRisks };
//# sourceMappingURL=analyze.d.ts.map