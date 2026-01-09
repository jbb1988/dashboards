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

// Generate AI Recommendations as a separate document
function generateAiRecommendationsDoc(
  comparisonResult: SectionCompareResult,
  analysisResult: ComparisonAnalysisResult
): Document {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: 'AI Contract Analysis Recommendations',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Document Info
  children.push(
    new Paragraph({
      text: 'Analysis Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Documents Compared: ', bold: true }),
        new TextRun({ text: `${comparisonResult.documentInfo.originalTitle} vs ${comparisonResult.documentInfo.revisedTitle}` }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Analysis Date: ', bold: true }),
        new TextRun({ text: new Date().toLocaleDateString() }),
      ],
      spacing: { after: 200 },
    })
  );

  // Overall Assessment
  children.push(
    new Paragraph({
      text: 'Overall Assessment',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      text: analysisResult.overallAssessment,
      spacing: { after: 200 },
    })
  );

  // Critical Issues
  if (analysisResult.criticalIssues && analysisResult.criticalIssues.length > 0) {
    children.push(
      new Paragraph({
        text: 'Critical Issues Requiring Attention',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const issue of analysisResult.criticalIssues) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '⚠ ', color: 'FF0000', bold: true }),
            new TextRun({ text: issue }),
          ],
          spacing: { after: 100 },
        })
      );
    }
  }

  // Recommendations Summary
  const pushBackCount = analysisResult.recommendations.filter(r => r.verdict === 'push_back').length;
  const negotiateCount = analysisResult.recommendations.filter(r => r.verdict === 'negotiate').length;
  const acceptCount = analysisResult.recommendations.filter(r => r.verdict === 'accept').length;

  children.push(
    new Paragraph({
      text: 'Recommendations Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      text: `Total Sections Analyzed: ${analysisResult.recommendations.length}`,
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '✓ Accept: ', color: '22C55E', bold: true }),
        new TextRun({ text: `${acceptCount} sections` }),
      ],
      spacing: { after: 50 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '⚠ Negotiate: ', color: 'F59E0B', bold: true }),
        new TextRun({ text: `${negotiateCount} sections` }),
      ],
      spacing: { after: 50 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '✗ Push Back: ', color: 'EF4444', bold: true }),
        new TextRun({ text: `${pushBackCount} sections` }),
      ],
      spacing: { after: 200 },
    })
  );

  // Detailed Recommendations
  children.push(
    new Paragraph({
      text: 'Detailed Recommendations',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  for (const rec of analysisResult.recommendations) {
    const verdictColor = rec.verdict === 'push_back' ? 'EF4444' :
                         rec.verdict === 'negotiate' ? 'F59E0B' : '22C55E';
    const verdictText = rec.verdict === 'push_back' ? 'PUSH BACK' :
                        rec.verdict === 'negotiate' ? 'NEGOTIATE' : 'ACCEPT';

    // Section header
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Section ${rec.sectionNumber}: ${rec.sectionTitle}`, bold: true }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );

    // Verdict badge
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Recommendation: ${verdictText}`, bold: true, color: verdictColor }),
          new TextRun({ text: ` | Risk Level: ${rec.riskLevel.toUpperCase()}`, italics: true }),
        ],
        spacing: { after: 100 },
      })
    );

    // Reasoning
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Reasoning: ', bold: true }),
          new TextRun({ text: rec.reasoning }),
        ],
        spacing: { after: 100 },
      })
    );

    // Suggested counter-language
    if (rec.suggestedLanguage) {
      children.push(
        new Paragraph({
          text: 'Suggested Counter-Language:',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 },
        })
      );
      children.push(
        new Paragraph({
          text: rec.suggestedLanguage,
          shading: { fill: 'F0FDF4' },
          spacing: { after: 100 },
        })
      );
    }

    // Separator
    children.push(
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
        },
        spacing: { after: 200 },
      })
    );
  }

  // Footer
  children.push(
    new Paragraph({
      text: `AI Analysis generated: ${new Date().toLocaleString()}`,
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

    // 3. Upload Comparison Report to Supabase Storage
    const timestamp = Date.now();
    const safeContractName = contract.name.replace(/[^a-zA-Z0-9]/g, '_');
    const comparisonFileName = `${safeContractName}-Comparison-${timestamp}.docx`;
    const comparisonStoragePath = `comparisons/${contractId}/${comparisonFileName}`;

    console.log('[SAVE] Uploading comparison to storage:', comparisonStoragePath);

    const { error: uploadError } = await supabase.storage
      .from('data-files')
      .upload(comparisonStoragePath, buffer, {
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

    // Get public URL for the comparison report
    const { data: comparisonUrlData } = supabase.storage
      .from('data-files')
      .getPublicUrl(comparisonStoragePath);

    const comparisonPublicUrl = comparisonUrlData?.publicUrl || comparisonStoragePath;

    // 4. Create Comparison Report document record
    console.log('[SAVE] Creating comparison document record...');

    const comparisonRecord = {
      contract_id: contractId,
      account_name: contract.account_name,
      opportunity_name: contract.opportunity_name,
      document_type: 'Comparison Report',
      status: 'under_review',
      file_name: comparisonFileName,
      file_url: comparisonPublicUrl,
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
        storagePath: comparisonStoragePath,
        timestamp: new Date().toISOString(),
      },
    };

    const { data: comparisonDoc, error: comparisonInsertError } = await supabase
      .from('documents')
      .insert(comparisonRecord)
      .select()
      .single();

    if (comparisonInsertError) {
      console.error('[SAVE] Comparison insert error:', comparisonInsertError);
      await supabase.storage.from('data-files').remove([comparisonStoragePath]);
      return NextResponse.json(
        { error: 'Failed to create comparison document record' },
        { status: 500 }
      );
    }

    console.log('[SAVE] Comparison document saved:', comparisonDoc.id);

    // 5. If AI Recommendations exist, save them as a separate document
    let aiRecommendationsDoc = null;
    if (analysisResult && analysisResult.recommendations && analysisResult.recommendations.length > 0) {
      console.log('[SAVE] Saving AI Recommendations as separate document...');

      // Generate AI Recommendations document
      const aiDoc = generateAiRecommendationsDoc(comparisonResult, analysisResult);
      const aiBuffer = await Packer.toBuffer(aiDoc);

      const aiFileName = `${safeContractName}-AI-Recommendations-${timestamp}.docx`;
      const aiStoragePath = `comparisons/${contractId}/${aiFileName}`;

      const { error: aiUploadError } = await supabase.storage
        .from('data-files')
        .upload(aiStoragePath, aiBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false,
        });

      if (!aiUploadError) {
        const { data: aiUrlData } = supabase.storage
          .from('data-files')
          .getPublicUrl(aiStoragePath);

        const aiPublicUrl = aiUrlData?.publicUrl || aiStoragePath;

        const aiRecord = {
          contract_id: contractId,
          account_name: contract.account_name,
          opportunity_name: contract.opportunity_name,
          document_type: 'AI Recommendations',
          status: 'under_review',
          file_name: aiFileName,
          file_url: aiPublicUrl,
          file_size: aiBuffer.length,
          file_mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          notes: `AI Analysis for: ${originalFileName} vs ${revisedFileName}`,
          metadata: {
            originalDocument: originalFileName,
            revisedDocument: revisedFileName,
            overallAssessment: analysisResult.overallAssessment,
            criticalIssues: analysisResult.criticalIssues,
            totalRecommendations: analysisResult.recommendations.length,
            recommendations: analysisResult.recommendations.map(r => ({
              section: `${r.sectionNumber}. ${r.sectionTitle}`,
              verdict: r.verdict,
              riskLevel: r.riskLevel,
              reasoning: r.reasoning,
            })),
            storagePath: aiStoragePath,
            timestamp: new Date().toISOString(),
          },
        };

        const { data: aiDocRecord, error: aiInsertError } = await supabase
          .from('documents')
          .insert(aiRecord)
          .select()
          .single();

        if (!aiInsertError) {
          aiRecommendationsDoc = aiDocRecord;
          console.log('[SAVE] AI Recommendations document saved:', aiDocRecord.id);
        } else {
          console.error('[SAVE] AI Recommendations insert error:', aiInsertError);
        }
      } else {
        console.error('[SAVE] AI Recommendations upload error:', aiUploadError);
      }
    }

    console.log('[SAVE] All documents saved successfully');
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      comparisonDocumentId: comparisonDoc.id,
      aiRecommendationsDocumentId: aiRecommendationsDoc?.id || null,
      fileName: comparisonFileName,
      storagePath: comparisonStoragePath,
      contractName: contract.name,
      savedDocuments: {
        comparison: {
          id: comparisonDoc.id,
          fileName: comparisonFileName,
          url: comparisonPublicUrl,
        },
        aiRecommendations: aiRecommendationsDoc ? {
          id: aiRecommendationsDoc.id,
          fileName: aiRecommendationsDoc.file_name,
          url: aiRecommendationsDoc.file_url,
        } : null,
      },
    });

  } catch (error) {
    console.error('[SAVE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 }
    );
  }
}
