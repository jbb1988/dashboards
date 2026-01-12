import { NextRequest, NextResponse } from 'next/server';
import DiffMatchPatch from 'diff-match-patch';

interface CompareChange {
  id: number;
  type: 'equal' | 'delete' | 'insert';
  text: string;
}

interface CompareStats {
  totalChanges: number;
  deletions: number;
  insertions: number;
  originalLength: number;
  revisedLength: number;
  characterChanges: number;
}

interface CompareResult {
  mode: 'diff';
  changes: CompareChange[];
  stats: CompareStats;
  sections: [];
  normalizedOriginal: string;
  normalizedRevised: string;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalText, revisedText } = body;

    if (!originalText || !revisedText) {
      return NextResponse.json(
        { error: 'Both originalText and revisedText are required' },
        { status: 400 }
      );
    }

    const normalizedOriginal = normalizeText(originalText);
    const normalizedRevised = normalizeText(revisedText);

    // Use diff-match-patch for word-level diffing
    const dmp = new DiffMatchPatch();

    // Make semantic diffs (word-level, not character-level)
    const diffs = dmp.diff_main(normalizedOriginal, normalizedRevised);
    dmp.diff_cleanupSemantic(diffs);

    // Convert to our format
    const changes: CompareChange[] = [];
    let id = 0;
    let deletions = 0;
    let insertions = 0;
    let characterChanges = 0;

    for (const [op, text] of diffs) {
      let type: 'equal' | 'delete' | 'insert';

      if (op === 0) {
        type = 'equal';
      } else if (op === -1) {
        type = 'delete';
        deletions++;
        characterChanges += text.length;
      } else {
        type = 'insert';
        insertions++;
        characterChanges += text.length;
      }

      changes.push({
        id: id++,
        type,
        text,
      });
    }

    const result: CompareResult = {
      mode: 'diff',
      changes,
      stats: {
        totalChanges: deletions + insertions,
        deletions,
        insertions,
        originalLength: normalizedOriginal.length,
        revisedLength: normalizedRevised.length,
        characterChanges,
      },
      sections: [],
      normalizedOriginal,
      normalizedRevised,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[DIFF] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Diff comparison failed' },
      { status: 500 }
    );
  }
}
