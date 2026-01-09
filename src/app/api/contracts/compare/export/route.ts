import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ============================================================================
// TYPES
// ============================================================================

interface SectionChange {
  description: string;
  original: string;
  revised: string;
  impact: string;
}

interface SectionComparison {
  sectionNumber: string;
  sectionTitle: string;
  status: 'unchanged' | 'changed' | 'added' | 'removed';
  significance: 'high' | 'medium' | 'low' | 'none';
  reasoning?: string;
  changes: SectionChange[];
}

interface SectionCompareResult {
  mode: 'section-by-section';
  documentInfo: {
    originalTitle: string;
    revisedTitle: string;
    originalDate: string;
    revisedDate: string;
  };
  summary: {
    totalSections: number;
    sectionsChanged: number;
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsUnchanged: number;
    keyTakeaways: string[];
  };
  sections: SectionComparison[];
  addedSections: string[];
  removedSections: string[];
}

interface ComparisonRecommendation {
  sectionNumber: string;
  sectionTitle: string;
  verdict: 'accept' | 'negotiate' | 'push_back';
  reasoning: string;
  suggestedLanguage?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ComparisonAnalysisResult {
  recommendations: ComparisonRecommendation[];
  overallAssessment: string;
  criticalIssues: string[];
}

interface ExportRequest {
  type: 'comparison' | 'recommendations';
  comparisonResult: SectionCompareResult;
  analysisResult?: ComparisonAnalysisResult;
}

// ============================================================================
// PDF GENERATION HELPERS
// ============================================================================

const COLORS = {
  title: rgb(0.1, 0.1, 0.3),
  heading: rgb(0.2, 0.2, 0.4),
  text: rgb(0.2, 0.2, 0.2),
  lightText: rgb(0.4, 0.4, 0.4),
  green: rgb(0.13, 0.77, 0.37),
  red: rgb(0.93, 0.27, 0.27),
  yellow: rgb(0.96, 0.62, 0.04),
  blue: rgb(0.22, 0.74, 0.97),
  purple: rgb(0.55, 0.36, 0.96),
};

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// ============================================================================
// COMPARISON PDF GENERATION
// ============================================================================

async function generateComparisonPDF(comparisonResult: SectionCompareResult): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();
  const margin = 50;
  const maxWidth = width - 2 * margin;
  let y = height - margin;

  const addPage = () => {
    page = pdfDoc.addPage([612, 792]);
    y = height - margin;
    return page;
  };

  const checkSpace = (needed: number) => {
    if (y - needed < margin) {
      addPage();
    }
  };

  // Title
  page.drawText('Contract Comparison Report', {
    x: margin,
    y,
    size: 24,
    font: helveticaBold,
    color: COLORS.title,
  });
  y -= 40;

  // Document Info
  page.drawText('Document Information', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: COLORS.heading,
  });
  y -= 20;

  page.drawText(`Original: ${comparisonResult.documentInfo.originalTitle}`, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: COLORS.text,
  });
  y -= 14;

  page.drawText(`Revised: ${comparisonResult.documentInfo.revisedTitle}`, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: COLORS.text,
  });
  y -= 25;

  // Summary
  page.drawText('Summary', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: COLORS.heading,
  });
  y -= 18;

  const { summary } = comparisonResult;
  const summaryText = `Total Sections: ${summary.totalSections} | Changed: ${summary.sectionsChanged} | Added: ${summary.sectionsAdded} | Removed: ${summary.sectionsRemoved} | Unchanged: ${summary.sectionsUnchanged}`;
  page.drawText(summaryText, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: COLORS.text,
  });
  y -= 25;

  // Key Takeaways
  page.drawText('Key Takeaways', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: COLORS.heading,
  });
  y -= 18;

  for (const takeaway of summary.keyTakeaways.slice(0, 5)) {
    checkSpace(30);
    const lines = wrapText(`• ${takeaway}`, maxWidth - 10, helvetica, 10);
    for (const line of lines) {
      page.drawText(line, {
        x: margin + 5,
        y,
        size: 10,
        font: helvetica,
        color: COLORS.text,
      });
      y -= 14;
    }
  }
  y -= 15;

  // Section-by-Section Analysis
  checkSpace(50);
  page.drawText('Section-by-Section Analysis', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: COLORS.heading,
  });
  y -= 25;

  // Only show changed sections
  const changedSections = comparisonResult.sections.filter(s => s.status !== 'unchanged');

  for (const section of changedSections) {
    checkSpace(80);

    // Section header
    const statusColor = section.status === 'added' ? COLORS.green :
                        section.status === 'removed' ? COLORS.red :
                        COLORS.yellow;

    page.drawText(`Section ${section.sectionNumber}: ${section.sectionTitle}`, {
      x: margin,
      y,
      size: 11,
      font: helveticaBold,
      color: COLORS.text,
    });

    page.drawText(`[${section.status.toUpperCase()}]`, {
      x: margin + 300,
      y,
      size: 9,
      font: helveticaBold,
      color: statusColor,
    });

    page.drawText(`${section.significance.toUpperCase()} significance`, {
      x: margin + 380,
      y,
      size: 9,
      font: helvetica,
      color: COLORS.lightText,
    });
    y -= 18;

    // Changes in this section
    for (const change of section.changes.slice(0, 3)) {
      checkSpace(60);

      // Description
      const descLines = wrapText(change.description, maxWidth - 20, helvetica, 9);
      for (const line of descLines) {
        page.drawText(line, {
          x: margin + 10,
          y,
          size: 9,
          font: helvetica,
          color: COLORS.text,
        });
        y -= 12;
      }

      // Original
      if (change.original) {
        page.drawText('Original: ', {
          x: margin + 10,
          y,
          size: 9,
          font: helveticaBold,
          color: COLORS.red,
        });
        const origText = truncateText(change.original, 80);
        page.drawText(origText, {
          x: margin + 60,
          y,
          size: 9,
          font: helvetica,
          color: COLORS.lightText,
        });
        y -= 12;
      }

      // Revised
      if (change.revised) {
        page.drawText('Revised: ', {
          x: margin + 10,
          y,
          size: 9,
          font: helveticaBold,
          color: COLORS.green,
        });
        const revText = truncateText(change.revised, 80);
        page.drawText(revText, {
          x: margin + 60,
          y,
          size: 9,
          font: helvetica,
          color: COLORS.lightText,
        });
        y -= 12;
      }
      y -= 8;
    }
    y -= 10;
  }

  // Footer
  checkSpace(30);
  page.drawText(`Generated: ${new Date().toLocaleString()}`, {
    x: margin,
    y: margin,
    size: 8,
    font: helvetica,
    color: COLORS.lightText,
  });

  return pdfDoc.save();
}

// ============================================================================
// AI RECOMMENDATIONS PDF GENERATION
// ============================================================================

async function generateRecommendationsPDF(
  comparisonResult: SectionCompareResult,
  analysisResult: ComparisonAnalysisResult
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const margin = 50;
  const maxWidth = width - 2 * margin;
  let y = height - margin;

  const addPage = () => {
    page = pdfDoc.addPage([612, 792]);
    y = height - margin;
    return page;
  };

  const checkSpace = (needed: number) => {
    if (y - needed < margin) {
      addPage();
    }
  };

  // Title
  page.drawText('AI Contract Analysis Recommendations', {
    x: margin,
    y,
    size: 22,
    font: helveticaBold,
    color: COLORS.purple,
  });
  y -= 35;

  // Document Info
  page.drawText(`Analysis of: ${comparisonResult.documentInfo.revisedTitle}`, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: COLORS.lightText,
  });
  y -= 25;

  // Overall Assessment
  page.drawText('Overall Assessment', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: COLORS.heading,
  });
  y -= 18;

  const assessmentLines = wrapText(analysisResult.overallAssessment, maxWidth, helvetica, 10);
  for (const line of assessmentLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: COLORS.text,
    });
    y -= 14;
  }
  y -= 15;

  // Critical Issues
  if (analysisResult.criticalIssues.length > 0) {
    checkSpace(50);
    page.drawText('Critical Issues Requiring Attention', {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: COLORS.red,
    });
    y -= 18;

    for (const issue of analysisResult.criticalIssues) {
      checkSpace(30);
      const issueLines = wrapText(`• ${issue}`, maxWidth - 10, helvetica, 10);
      for (const line of issueLines) {
        page.drawText(line, {
          x: margin + 5,
          y,
          size: 10,
          font: helvetica,
          color: COLORS.text,
        });
        y -= 14;
      }
    }
    y -= 15;
  }

  // Recommendations Summary
  const pushBackCount = analysisResult.recommendations.filter(r => r.verdict === 'push_back').length;
  const negotiateCount = analysisResult.recommendations.filter(r => r.verdict === 'negotiate').length;
  const acceptCount = analysisResult.recommendations.filter(r => r.verdict === 'accept').length;

  checkSpace(40);
  page.drawText('Recommendation Summary', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: COLORS.heading,
  });
  y -= 18;

  page.drawText(`Accept: ${acceptCount}`, {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: COLORS.green,
  });
  page.drawText(`Negotiate: ${negotiateCount}`, {
    x: margin + 100,
    y,
    size: 10,
    font: helveticaBold,
    color: COLORS.yellow,
  });
  page.drawText(`Push Back: ${pushBackCount}`, {
    x: margin + 220,
    y,
    size: 10,
    font: helveticaBold,
    color: COLORS.red,
  });
  y -= 30;

  // Section-by-Section Recommendations (only non-accept)
  const actionableRecs = analysisResult.recommendations.filter(r => r.verdict !== 'accept');

  if (actionableRecs.length > 0) {
    checkSpace(30);
    page.drawText('Sections Requiring Action', {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: COLORS.heading,
    });
    y -= 25;

    for (const rec of actionableRecs) {
      checkSpace(100);

      // Section header with verdict
      const verdictColor = rec.verdict === 'push_back' ? COLORS.red : COLORS.yellow;
      const verdictText = rec.verdict === 'push_back' ? 'PUSH BACK' : 'NEGOTIATE';

      page.drawText(`Section ${rec.sectionNumber}: ${rec.sectionTitle}`, {
        x: margin,
        y,
        size: 11,
        font: helveticaBold,
        color: COLORS.text,
      });

      page.drawText(`[${verdictText}]`, {
        x: margin + 350,
        y,
        size: 10,
        font: helveticaBold,
        color: verdictColor,
      });
      y -= 18;

      // Risk level
      page.drawText(`Risk Level: ${rec.riskLevel.toUpperCase()}`, {
        x: margin + 10,
        y,
        size: 9,
        font: helvetica,
        color: COLORS.lightText,
      });
      y -= 14;

      // Reasoning
      const reasoningLines = wrapText(rec.reasoning, maxWidth - 20, helvetica, 10);
      for (const line of reasoningLines) {
        checkSpace(14);
        page.drawText(line, {
          x: margin + 10,
          y,
          size: 10,
          font: helvetica,
          color: COLORS.text,
        });
        y -= 14;
      }
      y -= 5;

      // Suggested Language
      if (rec.suggestedLanguage) {
        checkSpace(40);
        page.drawText('Suggested Counter-Language:', {
          x: margin + 10,
          y,
          size: 10,
          font: helveticaBold,
          color: COLORS.green,
        });
        y -= 14;

        const langLines = wrapText(rec.suggestedLanguage, maxWidth - 30, helvetica, 9);
        for (const line of langLines.slice(0, 4)) {
          checkSpace(12);
          page.drawText(line, {
            x: margin + 15,
            y,
            size: 9,
            font: helvetica,
            color: COLORS.text,
          });
          y -= 12;
        }
        if (langLines.length > 4) {
          page.drawText('[...continued in full report]', {
            x: margin + 15,
            y,
            size: 8,
            font: helvetica,
            color: COLORS.lightText,
          });
          y -= 12;
        }
      }
      y -= 15;
    }
  }

  // Footer
  page.drawText(`Generated: ${new Date().toLocaleString()}`, {
    x: margin,
    y: margin,
    size: 8,
    font: helvetica,
    color: COLORS.lightText,
  });

  return pdfDoc.save();
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ExportRequest;
    const { type, comparisonResult, analysisResult } = body;

    if (!comparisonResult) {
      return NextResponse.json(
        { error: 'Comparison result is required' },
        { status: 400 }
      );
    }

    if (type === 'recommendations' && !analysisResult) {
      return NextResponse.json(
        { error: 'Analysis result is required for recommendations export' },
        { status: 400 }
      );
    }

    console.log('[EXPORT] Generating PDF:', type);

    let pdfBytes: Uint8Array;
    let fileName: string;

    if (type === 'comparison') {
      pdfBytes = await generateComparisonPDF(comparisonResult);
      fileName = `Comparison-Report-${Date.now()}.pdf`;
    } else {
      pdfBytes = await generateRecommendationsPDF(comparisonResult, analysisResult!);
      fileName = `AI-Recommendations-${Date.now()}.pdf`;
    }

    console.log('[EXPORT] PDF generated successfully, size:', pdfBytes.length);

    // Return as base64 for client-side download
    const base64 = Buffer.from(pdfBytes).toString('base64');

    return NextResponse.json({
      success: true,
      pdf: base64,
      fileName,
      mimeType: 'application/pdf',
    });

  } catch (error) {
    console.error('[EXPORT] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF export failed' },
      { status: 500 }
    );
  }
}
