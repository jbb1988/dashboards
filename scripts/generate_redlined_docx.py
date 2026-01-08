#!/usr/bin/env python3
"""
Generate a DOCX with Track Changes using Aspose.Words for Python.

This script is called by the Node.js API to generate redlined documents.
It uses startTrackRevisions() to create real Word track changes.

Input (JSON from stdin):
{
  "originalDocxBase64": "base64 encoded docx",
  "originalText": "original text for diffing",
  "modifiedText": "AI-modified text",
  "author": "MARS AI Review"
}

Output (JSON to stdout):
{
  "success": true,
  "docxBase64": "base64 encoded result",
  "editsApplied": 5,
  "editsTotal": 7
}
"""

import sys
import json
import base64
from datetime import datetime
from io import BytesIO

import aspose.words as aw
from diff_match_patch import diff_match_patch


def normalize_text(text: str) -> str:
    """
    Normalize text to prevent spurious diffs from quote styles, dashes, etc.
    Must match the normalizeText() function in route.ts
    """
    import re
    # Smart double quotes → straight
    text = re.sub(r'[\u201C\u201D\u201E\u201F\u2033\u2036]', '"', text)
    # Smart single quotes → straight
    text = re.sub(r'[\u2018\u2019\u201A\u201B\u2032\u2035]', "'", text)
    # En/em dashes → hyphen
    text = re.sub(r'[\u2013\u2014\u2015]', '-', text)
    # Non-breaking/special spaces → regular
    text = re.sub(r'[\u00A0\u2000-\u200B]', ' ', text)
    # Ellipsis → three dots
    text = text.replace('\u2026', '...')
    return text


def extract_word_level_edits(original_text: str, modified_text: str) -> list:
    """
    Use diff-match-patch to extract precise word-level edits.
    Returns list of (find, replace) tuples where we need to replace 'find' with 'replace'.

    Groups consecutive deletions and insertions into single edits for reliable matching.
    """
    dmp = diff_match_patch()

    # Normalize both texts to prevent spurious diffs from quote/dash styles
    normalized_original = normalize_text(original_text)
    normalized_modified = normalize_text(modified_text)

    # Get character-level diff on NORMALIZED text
    diffs = dmp.diff_main(normalized_original, normalized_modified)
    dmp.diff_cleanupSemantic(diffs)

    edits = []
    i = 0

    while i < len(diffs):
        op, text = diffs[i]

        if op == 0:
            # Equal - no change, skip
            i += 1
            continue

        if op == -1:
            # Deletion - check if followed by insertion (replacement)
            deleted_text = text
            inserted_text = ""

            # Look for following insertion
            if i + 1 < len(diffs) and diffs[i + 1][0] == 1:
                inserted_text = diffs[i + 1][1]
                i += 1

            # Only create edit if there's actual content change
            if deleted_text.strip() or inserted_text.strip():
                # Expand to word boundaries for more reliable matching
                # Find surrounding context
                context_before = ""
                context_after = ""

                # Get some context from previous equal section
                for j in range(i - 1, -1, -1):
                    if diffs[j][0] == 0:
                        words = diffs[j][1].split()
                        if words:
                            context_before = words[-1] + " " if len(words[-1]) > 2 else ""
                        break

                # Get some context from next equal section
                for j in range(i + 1, len(diffs)):
                    if diffs[j][0] == 0:
                        words = diffs[j][1].split()
                        if words:
                            context_after = " " + words[0] if len(words[0]) > 2 else ""
                        break

                find_text = context_before + deleted_text + context_after
                replace_text = context_before + inserted_text + context_after

                # Clean up whitespace
                find_text = find_text.strip()
                replace_text = replace_text.strip()

                if find_text and find_text != replace_text:
                    edits.append({
                        'find': find_text,
                        'replace': replace_text,
                        'deleted': deleted_text.strip(),
                        'inserted': inserted_text.strip()
                    })

        elif op == 1:
            # Pure insertion (no preceding deletion)
            # These are harder to place - skip for now as they need context
            pass

        i += 1

    return edits


def generate_redlined_docx(original_base64: str, original_text: str, modified_text: str, author: str = "MARS AI Review") -> dict:
    """
    Generate a DOCX with track changes.
    """
    try:
        # Decode original document
        original_bytes = base64.b64decode(original_base64)

        # Verify it's a valid DOCX (ZIP magic bytes)
        if original_bytes[:4] != b'PK\x03\x04':
            return {'success': False, 'error': 'Invalid DOCX file format'}

        # Load document from bytes
        doc_stream = BytesIO(original_bytes)
        doc = aw.Document(doc_stream)

        # Extract edits using diff-match-patch
        edits = extract_word_level_edits(original_text, modified_text)

        print(f"Found {len(edits)} edits to apply", file=sys.stderr)

        # Start tracking revisions
        doc.start_track_revisions(author, datetime.now())

        # Apply each edit
        applied_count = 0
        options = aw.replacing.FindReplaceOptions()
        options.match_case = True  # Use case-sensitive for precise matching

        for edit in edits:
            find_text = edit['find']
            replace_text = edit['replace']

            # Skip very short matches (too likely to match wrong text)
            if len(find_text) < 10:
                print(f"Skipping short edit: '{find_text[:30]}'", file=sys.stderr)
                continue

            try:
                # Try exact match first
                matches = doc.range.replace(find_text, replace_text, options)

                if matches > 0:
                    applied_count += 1
                    print(f"Applied: '{edit['deleted'][:30]}' -> '{edit['inserted'][:30]}'", file=sys.stderr)
                else:
                    # Try case-insensitive if exact match fails
                    options.match_case = False
                    matches = doc.range.replace(find_text, replace_text, options)
                    options.match_case = True

                    if matches > 0:
                        applied_count += 1
                        print(f"Applied (case-insensitive): '{find_text[:30]}'", file=sys.stderr)
                    else:
                        print(f"No match for: '{find_text[:50]}'", file=sys.stderr)

            except Exception as e:
                print(f"Error applying edit: {str(e)[:50]}", file=sys.stderr)

        # Stop tracking
        doc.stop_track_revisions()

        # Save to bytes
        output_stream = BytesIO()
        doc.save(output_stream, aw.SaveFormat.DOCX)
        output_bytes = output_stream.getvalue()

        # Encode result
        result_base64 = base64.b64encode(output_bytes).decode('utf-8')

        return {
            'success': True,
            'docxBase64': result_base64,
            'editsApplied': applied_count,
            'editsTotal': len(edits),
            'revisionsCount': doc.revisions.count
        }

    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }


def main():
    """Read JSON from stdin, process, write JSON to stdout."""
    try:
        # Read input
        input_data = json.load(sys.stdin)

        original_base64 = input_data.get('originalDocxBase64', '')
        original_text = input_data.get('originalText', '')
        modified_text = input_data.get('modifiedText', '')
        author = input_data.get('author', 'MARS AI Review')

        if not original_base64:
            print(json.dumps({'success': False, 'error': 'originalDocxBase64 is required'}))
            return

        if not original_text or not modified_text:
            print(json.dumps({'success': False, 'error': 'originalText and modifiedText are required'}))
            return

        # Generate redlined document
        result = generate_redlined_docx(original_base64, original_text, modified_text, author)

        # Output result
        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(json.dumps({'success': False, 'error': f'Invalid JSON input: {str(e)}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': f'Unexpected error: {str(e)}'}))


if __name__ == '__main__':
    main()
