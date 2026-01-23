import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Reuse text extraction utilities
const ASPOSE_CLIENT_ID = process.env.ASPOSE_CLIENT_ID;
const ASPOSE_CLIENT_SECRET = process.env.ASPOSE_CLIENT_SECRET;
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || '';

let cachedToken: { token: string; expires: number } | null = null;

async function getAsposeToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 300000) {
    return cachedToken.token;
  }

  if (!ASPOSE_CLIENT_ID || !ASPOSE_CLIENT_SECRET) {
    throw new Error('Aspose Cloud credentials not configured.');
  }

  const response = await fetch('https://api.aspose.cloud/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${ASPOSE_CLIENT_ID}&client_secret=${ASPOSE_CLIENT_SECRET}`,
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Aspose Cloud');
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return data.access_token;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function toRoman(n: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];

  let result = '';
  for (const [value, numeral] of romanNumerals) {
    while (n >= value) {
      result += numeral;
      n -= value;
    }
  }
  return result;
}

function formatListNumber(n: number, format: string): string {
  switch (format) {
    case 'decimal':
      return n.toString();
    case 'lowerLetter':
      return String.fromCharCode(96 + ((n - 1) % 26) + 1);
    case 'upperLetter':
      return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    case 'lowerRoman':
      return toRoman(n).toLowerCase();
    case 'upperRoman':
      return toRoman(n);
    default:
      return n.toString();
  }
}

function parseNumberingXml(xml: string): Record<string, Record<number, { format: string; text: string }>> {
  const result: Record<string, Record<number, { format: string; text: string }>> = {};
  const abstractNums: Record<string, Record<number, { format: string; text: string }>> = {};
  const abstractRegex = /<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  let abstractMatch;

  while ((abstractMatch = abstractRegex.exec(xml)) !== null) {
    const abstractId = abstractMatch[1];
    const content = abstractMatch[2];
    abstractNums[abstractId] = {};

    const lvlRegex = /<w:lvl[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
    let lvlMatch;
    while ((lvlMatch = lvlRegex.exec(content)) !== null) {
      const ilvl = parseInt(lvlMatch[1], 10);
      const lvlContent = lvlMatch[2];

      const formatMatch = lvlContent.match(/<w:numFmt[^>]*w:val="([^"]+)"/);
      const textMatch = lvlContent.match(/<w:lvlText[^>]*w:val="([^"]*)"/);

      abstractNums[abstractId][ilvl] = {
        format: formatMatch ? formatMatch[1] : 'decimal',
        text: textMatch ? textMatch[1] : '%1.',
      };
    }
  }

  const numRegex = /<w:num[^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId[^>]*w:val="(\d+)"/g;
  let numMatch;
  while ((numMatch = numRegex.exec(xml)) !== null) {
    const numId = numMatch[1];
    const abstractId = numMatch[2];
    if (abstractNums[abstractId]) {
      result[numId] = abstractNums[abstractId];
    }
  }

  return result;
}

async function extractDocxWithNumbering(buffer: Buffer): Promise<string> {
  const JSZip = require('jszip');

  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('string');
  const numberingXml = await zip.file('word/numbering.xml')?.async('string');

  if (!docXml) {
    throw new Error('Invalid DOCX: missing document.xml');
  }

  const numberingDefs = parseNumberingXml(numberingXml || '');
  const listCounters: Record<string, Record<number, number>> = {};
  const paragraphs: string[] = [];
  const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;

  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1];
    const textParts: string[] = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      textParts.push(decodeXmlEntities(tMatch[1]));
    }

    const text = textParts.join('').replace(/\s+/g, ' ').trim();

    const numPrMatch = pContent.match(/<w:numPr>[\s\S]*?<w:ilvl[^>]*w:val="(\d+)"[\s\S]*?<w:numId[^>]*w:val="(\d+)"/);
    if (numPrMatch) {
      const ilvl = parseInt(numPrMatch[1], 10);
      const numId = numPrMatch[2];

      const numDef = numberingDefs[numId];
      if (numDef && numDef[ilvl]) {
        const { text: numText } = numDef[ilvl];

        if (!listCounters[numId]) {
          listCounters[numId] = {};
        }
        if (listCounters[numId][ilvl] === undefined) {
          listCounters[numId][ilvl] = 0;
        }

        listCounters[numId][ilvl]++;

        for (let i = ilvl + 1; i < 10; i++) {
          listCounters[numId][i] = 0;
        }

        let prefix = numText;
        for (let i = 0; i <= ilvl; i++) {
          const levelNum = formatListNumber(listCounters[numId][i] || 1, numDef[i]?.format || 'decimal');
          prefix = prefix.replace(`%${i + 1}`, levelNum);
        }

        if (text && !prefix.endsWith(' ') && !prefix.endsWith('\t')) {
          prefix = prefix + ' ';
        }

        paragraphs.push(prefix + text);
      } else {
        paragraphs.push(text);
      }
    } else {
      paragraphs.push(text);
    }
  }

  return paragraphs.filter(p => p.trim()).join('\n\n');
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);

  try {
    const { extractText } = await import('unpdf');
    const result = await extractText(uint8Array, { mergePages: true });

    const text = result.text?.trim() || '';
    console.log(`PDF native extraction: ${result.totalPages} pages, ${text.length} chars`);

    if (text.length > 50) {
      return text;
    }
    console.log('Native extraction returned minimal text, trying OCR.space...');
  } catch (error) {
    console.log('Native PDF extraction failed, trying OCR.space...', error);
  }

  return extractPdfWithOCRSpace(buffer);
}

async function extractPdfWithOCRSpace(buffer: Buffer): Promise<string> {
  if (!OCR_SPACE_API_KEY) {
    throw new Error('OCR not configured. Add OCR_SPACE_API_KEY to environment variables.');
  }

  const { PDFDocument } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(buffer);
  const pageCount = pdfDoc.getPageCount();
  console.log(`OCR.space: Processing ${pageCount} pages...`);

  const extractedTexts: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    console.log(`OCR.space: Processing page ${i + 1}/${pageCount}...`);

    const singlePagePdf = await PDFDocument.create();
    const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
    singlePagePdf.addPage(copiedPage);

    const pageBytes = await singlePagePdf.save();
    const base64Page = Buffer.from(pageBytes).toString('base64');

    const formData = new URLSearchParams();
    formData.append('apikey', OCR_SPACE_API_KEY);
    formData.append('base64Image', `data:application/pdf;base64,${base64Page}`);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('filetype', 'PDF');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      extractedTexts.push(`[Page ${i + 1}: OCR service error]`);
      continue;
    }

    if (!response.ok || data.IsErroredOnProcessing) {
      extractedTexts.push(`[Page ${i + 1}: OCR failed]`);
      continue;
    }

    const pageText = data.ParsedResults
      ?.map((result: { ParsedText?: string }) => result.ParsedText || '')
      .join('\n')
      .trim() || '';

    if (pageText) {
      extractedTexts.push(pageText);
    }

    if (i < pageCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return extractedTexts.join('\n\n--- Page Break ---\n\n').trim();
}

// POST: Upload file and create new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playbookId } = await params;

    if (!playbookId) {
      return NextResponse.json(
        { error: 'Playbook ID is required' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const changeNotes = formData.get('changeNotes') as string | null;
    const createdBy = formData.get('createdBy') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate file type
    const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExt = validTypes.find(ext => filename.endsWith(ext));
    if (!fileExt) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files.' },
        { status: 400 }
      );
    }

    // Extract text from file
    let extractedText = '';

    if (filename.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else if (filename.endsWith('.pdf')) {
      const pdfMagic = buffer.slice(0, 5).toString('ascii');
      if (pdfMagic !== '%PDF-') {
        return NextResponse.json(
          { error: 'Invalid PDF file.' },
          { status: 400 }
        );
      }
      extractedText = await extractPdfText(buffer);
    } else if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
      try {
        extractedText = await extractDocxWithNumbering(buffer);
      } catch {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      }
    }

    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!extractedText) {
      return NextResponse.json(
        { error: 'No text could be extracted from the document.' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Verify playbook exists and get current version
    const { data: playbook, error: playbookError } = await admin
      .from('playbooks')
      .select('current_version')
      .eq('id', playbookId)
      .single();

    if (playbookError || !playbook) {
      return NextResponse.json(
        { error: 'Playbook not found' },
        { status: 404 }
      );
    }

    const newVersion = (playbook.current_version || 0) + 1;

    // Upload original file to Supabase Storage
    const storagePath = `playbooks/${playbookId}/v${newVersion}/${file.name}`;

    const { error: uploadError } = await admin.storage
      .from('playbook-files')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Continue without file storage - text is still saved
    }

    // Create the new version
    const { data: version, error: versionError } = await admin
      .from('playbook_versions')
      .insert({
        playbook_id: playbookId,
        version: newVersion,
        content: extractedText,
        change_notes: changeNotes?.trim() || `Uploaded ${file.name}`,
        created_by: createdBy || null,
        file_name: file.name,
        file_path: uploadError ? null : storagePath,
        file_type: fileExt.substring(1), // Remove leading dot
        file_size: buffer.length,
      })
      .select()
      .single();

    if (versionError) {
      console.error('Failed to create version:', versionError);
      return NextResponse.json(
        { error: 'Failed to create version' },
        { status: 500 }
      );
    }

    // Update playbook's current version
    await admin
      .from('playbooks')
      .update({
        current_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', playbookId);

    return NextResponse.json({
      success: true,
      version,
      extractedTextLength: extractedText.length,
    });
  } catch (error) {
    console.error('Playbook upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process file: ${errorMessage}` },
      { status: 500 }
    );
  }
}
