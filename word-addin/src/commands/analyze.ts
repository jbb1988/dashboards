/**
 * MARS Word Add-in Commands
 * Ribbon button command handlers
 */

// Office.js types are loaded from @types/office-js
// Office.js library is loaded from CDN in HTML
declare const Office: typeof globalThis.Office;
declare const Word: typeof globalThis.Word;

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://mars-contracts.vercel.app'
  : 'http://localhost:3000';

/**
 * Initialize Office.js for commands
 */
Office.onReady(() => {
  console.log('MARS Commands ready');
});

/**
 * Get the current document text
 */
async function getDocumentText(): Promise<string> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      const body = context.document.body;
      body.load('text');
      await context.sync();
      resolve(body.text);
    }).catch(reject);
  });
}

/**
 * Show notification in Word
 */
function showNotification(title: string, message: string, type: 'info' | 'error' = 'info') {
  Office.context.ui.displayDialogAsync(
    `${API_BASE}/word-addin/notification.html?title=${encodeURIComponent(title)}&message=${encodeURIComponent(message)}&type=${type}`,
    { height: 20, width: 30 },
    (result: Office.AsyncResult<Office.Dialog>) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        setTimeout(() => result.value.close(), 3000);
      }
    }
  );
}

/**
 * Analyze document command - called from ribbon button
 */
async function analyzeDocument(event: Office.AddinCommands.Event) {
  try {
    const token = localStorage.getItem('mars_token');

    if (!token) {
      showNotification('Authentication Required', 'Please sign in using the Review Panel first.', 'error');
      event.completed();
      return;
    }

    // Get document text
    const documentText = await getDocumentText();

    if (!documentText || documentText.trim().length < 100) {
      showNotification('Analysis Error', 'Document appears to be empty or too short to analyze.', 'error');
      event.completed();
      return;
    }

    // Show analyzing notification
    showNotification('Analyzing...', 'Please wait while we analyze your document.');

    // Call analysis API
    const response = await fetch(`${API_BASE}/api/word-addin/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ document_text: documentText }),
    });

    if (!response.ok) {
      throw new Error('Analysis failed');
    }

    const result = await response.json();

    // Highlight risks in document
    await highlightRisks(result.risks);

    // Show summary
    const riskCount = result.risks?.length || 0;
    const riskLevel = result.risk_level || 'unknown';
    showNotification(
      'Analysis Complete',
      `Found ${riskCount} issues. Risk level: ${riskLevel}. Open Review Panel for details.`,
      'info'
    );

  } catch (error) {
    console.error('Analysis error:', error);
    showNotification('Analysis Failed', 'An error occurred during analysis. Please try again.', 'error');
  }

  event.completed();
}

/**
 * Highlight identified risks in the document
 */
async function highlightRisks(risks: Array<{ location?: string; severity: string }>) {
  if (!risks || risks.length === 0) return;

  await Word.run(async (context: Word.RequestContext) => {
    for (const risk of risks) {
      if (risk.location) {
        const searchResults = context.document.body.search(risk.location.substring(0, 100), {
          matchCase: false,
          matchWholeWord: false,
        });
        searchResults.load('items');
        await context.sync();

        if (searchResults.items.length > 0) {
          const range = searchResults.items[0];
          // Color based on severity
          switch (risk.severity) {
            case 'high':
              range.font.highlightColor = '#FECACA'; // Light red
              break;
            case 'medium':
              range.font.highlightColor = '#FED7AA'; // Light orange
              break;
            case 'low':
              range.font.highlightColor = '#FEF08A'; // Light yellow
              break;
          }
        }
      }
    }
    await context.sync();
  });
}

/**
 * Insert clause at current selection
 */
async function insertClauseAtSelection(clauseText: string) {
  await Word.run(async (context: Word.RequestContext) => {
    const selection = context.document.getSelection();
    selection.insertText(clauseText, Word.InsertLocation.replace);
    await context.sync();
  });
}

/**
 * Clear all highlights from document
 */
async function clearHighlights() {
  await Word.run(async (context: Word.RequestContext) => {
    const body = context.document.body;
    body.font.highlightColor = 'NoHighlight';
    await context.sync();
  });
}

// Register commands globally
(globalThis as Record<string, unknown>).analyzeDocument = analyzeDocument;
(globalThis as Record<string, unknown>).insertClauseAtSelection = insertClauseAtSelection;
(globalThis as Record<string, unknown>).clearHighlights = clearHighlights;

export { analyzeDocument, insertClauseAtSelection, clearHighlights, highlightRisks };
