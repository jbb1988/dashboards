import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip } from 'docx';

/**
 * POST - Generate a plain-text DOCX from the ORIGINAL extracted text.
 *
 * PURPOSE: Create a document with identical formatting to the REVISED version
 * so Word Compare only shows CONTENT changes, not formatting differences.
 *
 * WORKFLOW:
 * 1. User uploads original contract → text extracted
 * 2. AI generates modified text → REVISED.docx
 * 3. This endpoint generates ORIGINAL-PLAIN.docx from extracted text
 * 4. User compares both in Word → only content changes shown
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalText, filename } = body;

    if (!originalText) {
      return NextResponse.json({ error: 'originalText is required' }, { status: 400 });
    }

    console.log('Generating original plain-text DOCX for Word Compare...');

    // Normalize text to match Word's character encoding
    const normalizedText = normalizeForWord(originalText);

    // Build document with IDENTICAL formatting to revised version
    const doc = new Document({
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
        children: normalizedText.split('\n').map((line: string) => {
          // Detect section headers (all caps or numbered sections)
          const isHeader = /^[A-Z\s]{10,}$/.test(line.trim()) ||
                          /^(SECTION|ARTICLE|EXHIBIT)\s+\d+/i.test(line.trim()) ||
                          /^\d+\.\s+[A-Z]/.test(line.trim());

          return new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 24, // 12pt
                font: 'Times New Roman',
                bold: isHeader,
              }),
            ],
            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: {
              after: 200, // 10pt spacing after paragraphs
              line: 276, // 1.15 line spacing
            },
          });
        }),
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const outputFilename = filename
      ? filename.replace(/\.docx$/i, '-ORIGINAL-PLAIN.docx')
      : 'contract-ORIGINAL-PLAIN.docx';

    console.log(`Generated ${outputFilename} (${buffer.length} bytes)`);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${outputFilename}"`,
      },
    });
  } catch (error) {
    console.error('Generate original DOCX error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate document: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Normalize text for Word document.
 *
 * IMPORTANT: Do NOT convert quotes, dashes, or other characters!
 * Converting creates character mismatches that cause Word Compare
 * to show spurious "strike and re-insert same word" changes.
 *
 * This MUST match the normalizeForWord() in generate-docx/route.ts
 */
function normalizeForWord(text: string): string {
  // Pass through unchanged - preserve exact character encoding
  // Both ORIGINAL-PLAIN.docx and REVISED.docx must use identical text
  return text;
}
