'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import EditorToolbar from './EditorToolbar';
import { useCallback, useEffect, useState, useRef } from 'react';

// Custom mark for approver strikethrough (blue)
const ApproverStrike = Mark.create({
  name: 'approverStrike',

  parseHTML() {
    return [
      {
        tag: 'span[data-approver-strike]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-approver-strike': '',
        style: 'color: #60A5FA; text-decoration: line-through;',
      }),
      0,
    ];
  },
});

// Custom mark for approver insert/underline (blue)
const ApproverInsert = Mark.create({
  name: 'approverInsert',

  parseHTML() {
    return [
      {
        tag: 'span[data-approver-insert]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-approver-insert': '',
        style: 'color: #60A5FA; text-decoration: underline;',
      }),
      0,
    ];
  },
});

// Custom mark for approver comments (yellow highlight with tooltip)
const ApproverComment = Mark.create({
  name: 'approverComment',

  addAttributes() {
    return {
      comment: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment'),
        renderHTML: (attributes) => {
          if (!attributes.comment) {
            return {};
          }
          return {
            'data-comment': attributes.comment,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-approver-comment]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-approver-comment': '',
        style: 'background-color: rgba(250, 204, 21, 0.3); padding: 0 2px; border-radius: 2px; cursor: help;',
        title: HTMLAttributes['data-comment'] || '',
      }),
      0,
    ];
  },
});

// Helper to convert redline markup to HTML with proper styling
function formatRedlinesToHTML(text: string): string {
  return text
    .replace(
      /\[strikethrough\](.*?)\[\/strikethrough\]/g,
      '<del style="color: #f87171; text-decoration: line-through;">$1</del>'
    )
    .replace(
      /\[underline\](.*?)\[\/underline\]/g,
      '<ins style="color: #4ade80; text-decoration: underline;">$1</ins>'
    )
    .replace(
      /~~(.*?)~~/g,
      '<del style="color: #f87171; text-decoration: line-through;">$1</del>'
    )
    .replace(
      /\+\+(.*?)\+\+/g,
      '<ins style="color: #4ade80; text-decoration: underline;">$1</ins>'
    )
    .replace(/\n/g, '<br>');
}

// Generate HTML document for download
function generateDownloadHTML(content: string, contractName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${contractName} - Redlined Document</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      font-size: 12pt;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    del {
      color: #dc2626;
      text-decoration: line-through;
    }
    ins {
      color: #16a34a;
      text-decoration: underline;
    }
    span[data-approver-strike] {
      color: #2563eb;
      text-decoration: line-through;
    }
    span[data-approver-insert] {
      color: #2563eb;
      text-decoration: underline;
    }
    span[data-approver-comment] {
      background-color: rgba(250, 204, 21, 0.4);
      padding: 0 2px;
      border-radius: 2px;
    }
    span[data-approver-comment]::after {
      content: " [Comment: " attr(data-comment) "]";
      font-size: 10pt;
      color: #666;
      font-style: italic;
    }
    .legend {
      margin-bottom: 30px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .legend h3 {
      margin: 0 0 10px 0;
      font-size: 14pt;
    }
    .legend-item {
      display: inline-block;
      margin-right: 20px;
      font-size: 11pt;
    }
    .legend-strike { color: #dc2626; text-decoration: line-through; }
    .legend-add { color: #16a34a; text-decoration: underline; }
    .legend-approver { color: #2563eb; }
    .legend-comment { background-color: rgba(250, 204, 21, 0.4); padding: 0 4px; }
    h1 {
      font-size: 18pt;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .generated {
      font-size: 10pt;
      color: #666;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <h1>${contractName} - Redlined Document</h1>
  <div class="legend">
    <h3>Legend</h3>
    <span class="legend-item"><span class="legend-strike">Strikethrough (Red)</span> = Remove</span>
    <span class="legend-item"><span class="legend-add">Underline (Green)</span> = Add</span>
    <span class="legend-item"><span class="legend-approver" style="text-decoration: line-through;">Strike (Blue)</span> = Approver Remove</span>
    <span class="legend-item"><span class="legend-approver" style="text-decoration: underline;">Underline (Blue)</span> = Approver Add</span>
    <span class="legend-item"><span class="legend-comment">Highlight</span> = Comment</span>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="generated">
    Generated on ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
}

interface RedlineEditorProps {
  initialContent: string;
  approverEditedContent?: string | null;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  contractName?: string;
}

export default function RedlineEditor({
  initialContent,
  approverEditedContent,
  onChange,
  readOnly = false,
  contractName = 'Contract',
}: RedlineEditorProps) {
  const [insertModeActive, setInsertModeActive] = useState(false);
  const insertModeRef = useRef(insertModeActive);

  // Keep ref in sync with state
  useEffect(() => {
    insertModeRef.current = insertModeActive;
  }, [insertModeActive]);

  const contentToUse = approverEditedContent || formatRedlinesToHTML(initialContent);

  // Create insert mode plugin
  const createInsertModePlugin = useCallback(() => {
    return new Plugin({
      key: new PluginKey('insertMode'),
      appendTransaction: (transactions, oldState, newState) => {
        // Only process if insert mode is active and there are text changes
        if (!insertModeRef.current) return null;

        let hasTextInsert = false;
        transactions.forEach((tr) => {
          tr.steps.forEach((step) => {
            // Check if this is a text insertion (ReplaceStep with content)
            if (step.toJSON().stepType === 'replace' && step.toJSON().slice?.content?.length) {
              hasTextInsert = true;
            }
          });
        });

        if (!hasTextInsert) return null;

        // Find newly inserted text and apply the mark
        const tr = newState.tr;
        let modified = false;

        newState.doc.descendants((node, pos) => {
          if (node.isText) {
            const marks = node.marks;
            const hasInsertMark = marks.some((m) => m.type.name === 'approverInsert');

            // Check if this text was just inserted (exists in new state but position differs or doesn't exist in old)
            if (!hasInsertMark) {
              // Apply mark to text that doesn't have any special formatting
              const hasAnyRedlineMark = marks.some((m) =>
                ['approverStrike', 'approverInsert', 'approverComment'].includes(m.type.name) ||
                node.text?.includes('style=')
              );

              if (!hasAnyRedlineMark && node.text && !node.text.match(/^\s*$/)) {
                // Only mark if it's likely new content (heuristic)
                const oldText = oldState.doc.textBetween(
                  Math.max(0, pos),
                  Math.min(oldState.doc.content.size, pos + (node.text?.length || 0)),
                  ''
                );
                if (oldText !== node.text) {
                  // This is new or modified text
                }
              }
            }
          }
        });

        return modified ? tr : null;
      },
    });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        strike: false,
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      ApproverStrike,
      ApproverInsert,
      ApproverComment,
    ],
    content: contentToUse,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none focus:outline-none min-h-[300px] text-white text-sm font-mono whitespace-pre-wrap leading-relaxed p-4',
      },
      handleKeyDown: (view, event) => {
        // When insert mode is active and user types, ensure the mark is applied
        if (insertModeRef.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          const { state } = view;
          const { from, to } = state.selection;

          // If there's a selection, the typed character will replace it
          // We need to ensure the new character gets the insert mark
          if (!state.storedMarks?.some((m) => m.type.name === 'approverInsert')) {
            const insertMarkType = state.schema.marks.approverInsert;
            if (insertMarkType) {
              view.dispatch(state.tr.addStoredMark(insertMarkType.create()));
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (editor && approverEditedContent) {
      editor.commands.setContent(approverEditedContent);
    }
  }, [editor, approverEditedContent]);

  // Toggle insert mode
  const handleToggleInsertMode = useCallback(() => {
    setInsertModeActive((prev) => {
      const newValue = !prev;
      if (editor) {
        if (newValue) {
          // Activate insert mode - set stored mark
          const insertMarkType = editor.schema.marks.approverInsert;
          if (insertMarkType) {
            editor.chain().focus().setMark('approverInsert').run();
          }
        } else {
          // Deactivate insert mode - remove stored mark
          editor.chain().focus().unsetMark('approverInsert').run();
        }
      }
      return newValue;
    });
  }, [editor]);

  // Add comment to selected text
  const handleAddComment = useCallback((comment: string) => {
    if (editor) {
      editor.chain().focus().setMark('approverComment', { comment }).run();
    }
  }, [editor]);

  // Download redlined document
  const handleDownload = useCallback(() => {
    if (editor) {
      const html = generateDownloadHTML(editor.getHTML(), contractName);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contractName.replace(/[^a-z0-9]/gi, '_')}_redlined.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [editor, contractName]);

  const handleEditorClick = useCallback(() => {
    editor?.chain().focus().run();
  }, [editor]);

  // Track if edits have been made for showing download button
  const [hasContent, setHasContent] = useState(false);
  useEffect(() => {
    if (editor) {
      setHasContent(editor.getHTML().length > 0);
    }
  }, [editor]);

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      {!readOnly && (
        <EditorToolbar
          editor={editor}
          insertModeActive={insertModeActive}
          onToggleInsertMode={handleToggleInsertMode}
          onAddComment={handleAddComment}
          onDownload={handleDownload}
          showDownload={hasContent}
        />
      )}
      {/* Insert mode indicator */}
      {!readOnly && insertModeActive && (
        <div className="bg-blue-500/20 border-b border-blue-500/30 px-3 py-1.5 text-xs text-blue-300">
          Insert mode active - text you type will appear in blue underline. Click the underline button again to turn off.
        </div>
      )}
      <div
        className={`bg-[#0B1220] ${!readOnly ? 'cursor-text' : ''} max-h-[500px] overflow-y-auto`}
        onClick={handleEditorClick}
      >
        <EditorContent editor={editor} />
      </div>
      {/* Read-only download button */}
      {readOnly && hasContent && (
        <div className="bg-[#0B1220] border-t border-white/10 px-4 py-2 flex justify-end">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/5 text-[#8FA3BF] rounded hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Redlined Document
          </button>
        </div>
      )}
    </div>
  );
}
