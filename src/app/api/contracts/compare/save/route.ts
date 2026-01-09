import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  convertInchesToTwip,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';

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

interface SaveRequest {
  contractId: string;
  comparisonResult: SectionCompareResult;
  analysisResult?: ComparisonAnalysisResult;
  originalFileName: string;
  revisedFileName: string;
  notes?: string;
}

// ============================================================================
// WORD DOCUMENT GENERATION
// ============================================================================

function generateComparisonDoc(
  comparisonResult: SectionCompareResult,
  analysisResult?: ComparisonAnalysisResult
): Document {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: 'Contract Comparison Report',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Document Info
  children.push(
    new Paragraph({
      text: 'Document Information',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Original: ', bold: true }),
        new TextRun({ text: comparisonResult.documentInfo.originalTitle }),
        new TextRun({ text: ` (${comparisonResult.documentInfo.originalDate})` }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Revised: ', bold: true }),
        new TextRun({ text: comparisonResult.documentInfo.revisedTitle }),
        new TextRun({ text: ` (${comparisonResult.documentInfo.revisedDate})` }),
      ],
      spacing: { after: 200 },
    })
  );

  // Summary Statistics
  children.push(
    new Paragraph({
      text: 'Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  const { summary } = comparisonResult;
  children.push(
    new Paragraph({
      text: `Total Sections: ${summary.totalSections} | Changed: ${summary.sectionsChanged} | Added: ${summary.sectionsAdded} | Removed: ${summary.sectionsRemoved} | Unchanged: ${summary.sectionsUnchanged}`,
      spacing: { after: 200 },
    })
  );

  // Overall Assessment (if AI analysis was run)
  if (analysisResult?.overallAssessment) {
    children.push(
      new Paragraph({
        text: 'Overall Assessment',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        text: analysisResult.overallAssessment,
        spacing: { after: 200 },
      })
    );
  }

  // Key Takeaways
  children.push(
    new Paragraph({
      text: 'Key Takeaways',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    })
  );

  for (const takeaway of summary.keyTakeaways) {
    children.push(
      new Paragraph({
        text: `• ${takeaway}`,
        spacing: { after: 100 },
      })
    );
  }

  // Critical Issues (if AI analysis was run)
  if (analysisResult?.criticalIssues && analysisResult.criticalIssues.length > 0) {
    children.push(
      new Paragraph({
        text: 'Critical Issues Requiring Attention',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );

    for (const issue of analysisResult.criticalIssues) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '⚠ ', color: 'FF0000' }),
            new TextRun({ text: issue }),
          ],
          spacing: { after: 100 },
        })
      );
    }
  }

  // Section-by-Section Details
  children.push(
    new Paragraph({
      text: 'Section-by-Section Analysis',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  // Find recommendation for each section
  const recommendationMap = new Map<string, ComparisonRecommendation>();
  if (analysisResult?.recommendations) {
    for (const rec of analysisResult.recommendations) {
      recommendationMap.set(`${rec.sectionNumber}-${rec.sectionTitle}`, rec);
    }
  }

  for (const section of comparisonResult.sections) {
    // Section Header
    const statusColor = section.status === 'added' ? '22C55E' :
                        section.status === 'removed' ? 'EF4444' :
                        section.status === 'changed' ? 'F59E0B' : '64748B';

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Section ${section.sectionNumber}: ${section.sectionTitle}`, bold: true }),
          new TextRun({ text: ` [${section.status.toUpperCase()}]`, color: statusColor }),
          new TextRun({ text: ` - ${section.significance.toUpperCase()} significance`, italics: true }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );

    // AI Recommendation (if available)
    const recommendation = recommendationMap.get(`${section.sectionNumber}-${section.sectionTitle}`);
    if (recommendation && recommendation.verdict !== 'accept') {
      const verdictColor = recommendation.verdict === 'push_back' ? 'EF4444' : 'F59E0B';
      const verdictIcon = recommendation.verdict === 'push_back' ? '✗ PUSH BACK' : '⚠ NEGOTIATE';

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `AI Recommendation: ${verdictIcon}`, bold: true, color: verdictColor }),
          ],
          spacing: { after: 50 },
        })
      );

      children.push(
        new Paragraph({
          text: recommendation.reasoning,
          spacing: { after: 100 },
        })
      );

      if (recommendation.suggestedLanguage) {
        children.push(
          new Paragraph({
            text: 'Suggested Counter-Language:',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 100, after: 50 },
          })
        );
        children.push(
          new Paragraph({
            text: recommendation.suggestedLanguage,
            shading: { fill: 'F0FDF4' },
            spacing: { after: 100 },
          })
        );
      }
    }

    // Changes in this section
    if (section.changes && section.changes.length > 0) {
      for (const change of section.changes) {
        children.push(
          new Paragraph({
            text: change.description,
            spacing: { before: 100, after: 50 },
          })
        );

        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Original: ', bold: true, color: 'EF4444' }),
              new TextRun({ text: change.original || '(Not present)' }),
            ],
            spacing: { after: 50 },
          })
        );

        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Revised: ', bold: true, color: '22C55E' }),
              new TextRun({ text: change.revised || '(Not present)' }),
            ],
            spacing: { after: 50 },
          })
        );

        if (change.impact) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Impact: ', bold: true }),
                new TextRun({ text: change.impact, italics: true }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      }
    } else if (section.status === 'unchanged') {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'No changes in this section.', italics: true })],
          spacing: { after: 100 },
        })
      );
    }

    // Add separator
    children.push(
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
        },
        spacing: { after: 200 },
      })
    );
  }

  // Footer with timestamp
  children.push(
    new Paragraph({
      text: `Report generated: ${new Date().toLocaleString()}`,
      alignment: AlignmentType.RIGHT,
      spacing: { before: 400 },
    })
  );

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      children,
    }],
  });
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SaveRequest;
    const {
      contractId,
      comparisonResult,
      analysisResult,
      originalFileName,
      revisedFileName,
      notes,
    } = body;

    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    if (!comparisonResult) {
      return NextResponse.json(
        { error: 'Comparison result is required' },
        { status: 400 }
      );
    }

    console.log('='.repeat(60));
    console.log('[SAVE] Saving comparison to contract:', contractId);
    console.log('='.repeat(60));

    const supabase = getSupabaseAdmin();

    // 1. Get contract details
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, name, account_name, opportunity_name')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      console.error('[SAVE] Contract not found:', contractError);
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // 2. Generate Word document
    console.log('[SAVE] Generating Word document...');
    const doc = generateComparisonDoc(comparisonResult, analysisResult);
    const buffer = await Packer.toBuffer(doc);

    // 3. Upload to Supabase Storage
    const timestamp = Date.now();
    const safeContractName = contract.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeContractName}-Comparison-${timestamp}.docx`;
    const storagePath = `comparisons/${contractId}/${fileName}`;

    console.log('[SAVE] Uploading to storage:', storagePath);

    const { error: uploadError } = await supabase.storage
      .from('data-files')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      });

    if (uploadError) {
      console.error('[SAVE] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload document' },
        { status: 500 }
      );
    }

    // 4. Create document record
    console.log('[SAVE] Creating document record...');

    const documentRecord = {
      contract_id: contractId,
      account_name: contract.account_name,
      opportunity_name: contract.opportunity_name,
      document_type: 'Comparison Report',
      status: 'under_review',
      file_name: fileName,
      file_url: storagePath,
      file_size: buffer.length,
      file_mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      notes: notes || `Comparison: ${originalFileName} vs ${revisedFileName}`,
      metadata: {
        comparisonType: 'section-by-section',
        originalDocument: originalFileName,
        revisedDocument: revisedFileName,
        documentInfo: comparisonResult.documentInfo,
        summary: comparisonResult.summary,
        hasAiRecommendations: !!analysisResult,
        recommendations: analysisResult?.recommendations?.map(r => ({
          section: `${r.sectionNumber}. ${r.sectionTitle}`,
          verdict: r.verdict,
          riskLevel: r.riskLevel,
        })),
        timestamp: new Date().toISOString(),
      },
    };

    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert(documentRecord)
      .select()
      .single();

    if (insertError) {
      console.error('[SAVE] Insert error:', insertError);
      // Try to clean up uploaded file
      await supabase.storage.from('data-files').remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    console.log('[SAVE] Document saved successfully:', document.id);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileName,
      storagePath,
      contractName: contract.name,
    });

  } catch (error) {
    console.error('[SAVE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 }
    );
  }
}
