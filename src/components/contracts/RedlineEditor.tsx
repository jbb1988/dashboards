'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark, mergeAttributes, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import EditorToolbar from './EditorToolbar';
import { useCallback, useEffect, useState, useRef } from 'react';
import { MessageSquare, X, Edit3 } from 'lucide-react';

// Custom mark for AI strikethrough (red) - text to remove
const AIStrike = Mark.create({
  name: 'aiStrike',
  parseHTML() {
    return [
      { tag: 'del' },
      { tag: 'span[data-ai-strike]' },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-ai-strike': '',
      style: 'color: #f87171; text-decoration: line-through;',
    }), 0];
  },
});

// Custom mark for AI insert (green) - text to add
const AIInsert = Mark.create({
  name: 'aiInsert',
  parseHTML() {
    return [
      { tag: 'ins' },
      { tag: 'span[data-ai-insert]' },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-ai-insert': '',
      style: 'color: #4ade80; text-decoration: underline;',
    }), 0];
  },
});

// Custom mark for approver strikethrough (blue)
const ApproverStrike = Mark.create({
  name: 'approverStrike',
  parseHTML() {
    return [{ tag: 'span[data-approver-strike]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-approver-strike': '',
      style: 'color: #60A5FA; text-decoration: line-through;',
    }), 0];
  },
});

// Custom mark for approver insert/underline (blue)
const ApproverInsert = Mark.create({
  name: 'approverInsert',
  parseHTML() {
    return [{ tag: 'span[data-approver-insert]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-approver-insert': '',
      style: 'color: #60A5FA; text-decoration: underline;',
    }), 0];
  },
});

// Custom mark for approver comments (yellow highlight with data)
const ApproverComment = Mark.create({
  name: 'approverComment',
  addAttributes() {
    return {
      comment: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-comment') || '',
        renderHTML: (attributes) => ({ 'data-comment': attributes.comment || '' }),
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => ({ 'data-comment-id': attributes.id || '' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-approver-comment]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-approver-comment': '',
      class: 'approver-comment',
      style: 'background-color: rgba(250, 204, 21, 0.3); padding: 0 2px; border-radius: 2px; cursor: pointer; position: relative;',
      title: HTMLAttributes['data-comment'] || '',
    }), 0];
  },
});

// Global ref for insert mode state (accessible by the plugin)
let insertModeRef = { current: false };

// Function to create the extension with access to the ref
function createInsertModeExtension() {
  return Extension.create({
    name: 'insertModeExtension',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('insertMode'),

          // Append transaction to add marks to newly typed text
          appendTransaction(transactions, oldState, newState) {
            if (!insertModeRef.current) return null;

            // Check if any transaction added text
            let hasInsertions = false;
            const ranges: { from: number; to: number }[] = [];

            for (const tr of transactions) {
              if (!tr.docChanged) continue;

              tr.steps.forEach((step) => {
                // @ts-expect-error - step has slice for ReplaceStep
                const slice = step.slice;
                if (slice && slice.content && slice.content.size > 0) {
                  // @ts-expect-error - step has from/to
                  const from = step.from;
                  const to = from + slice.content.size;

                  // Only mark if there's actual text content (not just structural changes)
                  let hasText = false;
                  slice.content.forEach((node: { isText: boolean; text?: string }) => {
                    if (node.isText && node.text && node.text.length > 0) {
                      hasText = true;
                    }
                  });

                  if (hasText) {
                    hasInsertions = true;
                    ranges.push({ from, to });
                  }
                }
              });
            }

            if (!hasInsertions || ranges.length === 0) return null;

            // Apply the approverInsert mark to the newly inserted text
            const markType = newState.schema.marks.approverInsert;
            if (!markType) return null;

            const tr = newState.tr;
            for (const range of ranges) {
              // Make sure positions are valid
              const docSize = tr.doc.content.size;
              const from = Math.max(0, Math.min(range.from, docSize));
              const to = Math.max(from, Math.min(range.to, docSize));
              if (from < to) {
                tr.addMark(from, to, markType.create());
              }
            }

            return tr.steps.length > 0 ? tr : null;
          },
        }),
      ];
    },
  });
}

// Helper to convert redline markup to HTML
function formatRedlinesToHTML(text: string): string {
  return text
    .replace(/\[strikethrough\]([\s\S]*?)\[\/strikethrough\]/g,
      '<span data-ai-strike style="color: #f87171; text-decoration: line-through;">$1</span>')
    .replace(/\[underline\]([\s\S]*?)\[\/underline\]/g,
      '<span data-ai-insert style="color: #4ade80; text-decoration: underline;">$1</span>')
    .replace(/~~([\s\S]*?)~~/g,
      '<span data-ai-strike style="color: #f87171; text-decoration: line-through;">$1</span>')
    .replace(/\+\+([\s\S]*?)\+\+/g,
      '<span data-ai-insert style="color: #4ade80; text-decoration: underline;">$1</span>')
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
    body { font-family: 'Courier New', monospace; font-size: 12pt; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    span[data-ai-strike] { color: #dc2626 !important; text-decoration: line-through !important; }
    span[data-ai-insert] { color: #16a34a !important; text-decoration: underline !important; }
    span[data-approver-strike] { color: #2563eb !important; text-decoration: line-through !important; }
    span[data-approver-insert] { color: #2563eb !important; text-decoration: underline !important; }
    span[data-approver-comment] { background-color: rgba(250, 204, 21, 0.4); padding: 0 2px; border-radius: 2px; }
    span[data-approver-comment]::after { content: " [" attr(data-comment) "]"; font-size: 10pt; color: #666; font-style: italic; }
    .legend { margin-bottom: 30px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
    .legend h3 { margin: 0 0 10px 0; }
    h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 10px; }
  </style>
</head>
<body>
  <h1>${contractName} - Redlined Document</h1>
  <div class="legend">
    <h3>Legend</h3>
    <span style="color: #dc2626; text-decoration: line-through;">Red Strike</span> = Remove |
    <span style="color: #16a34a; text-decoration: underline;">Green Underline</span> = Add |
    <span style="color: #2563eb; text-decoration: line-through;">Blue Strike</span> = Approver Remove |
    <span style="color: #2563eb; text-decoration: underline;">Blue Underline</span> = Approver Add |
    <span style="background-color: rgba(250, 204, 21, 0.4); padding: 0 4px;">Yellow</span> = Comment
  </div>
  <div class="content">${content}</div>
  <p style="margin-top: 30px; font-size: 10pt; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">Generated on ${new Date().toLocaleString()}</p>
</body>
</html>`;
}

interface Comment {
  id: string;
  text: string;
  highlightedText: string;
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const contentToUse = approverEditedContent || formatRedlinesToHTML(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ strike: false }),
      AIStrike,
      AIInsert,
      ApproverStrike,
      ApproverInsert,
      ApproverComment,
      createInsertModeExtension(),
    ],
    content: contentToUse,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[calc(100vh-180px)] text-white text-sm font-mono whitespace-pre-wrap leading-relaxed p-6',
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
      extractComments(editor.getHTML());
    },
  });

  // Sync insert mode state with the global ref
  useEffect(() => {
    insertModeRef.current = insertModeActive;
  }, [insertModeActive]);

  // Extract comments from HTML content
  const extractComments = useCallback((html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const commentElements = doc.querySelectorAll('span[data-approver-comment]');
    const newComments: Comment[] = [];

    commentElements.forEach((el, index) => {
      const id = el.getAttribute('data-comment-id') || `comment-${index}`;
      const text = el.getAttribute('data-comment') || '';
      const highlightedText = el.textContent || '';
      if (text || highlightedText) {
        newComments.push({ id, text, highlightedText });
      }
    });

    setComments(newComments);
  }, []);

  // Initial comment extraction
  useEffect(() => {
    if (editor) {
      extractComments(editor.getHTML());
    }
  }, [editor, extractComments]);

  useEffect(() => {
    if (editor && approverEditedContent) {
      editor.commands.setContent(approverEditedContent);
      extractComments(approverEditedContent);
    }
  }, [editor, approverEditedContent, extractComments]);

  const handleToggleInsertMode = useCallback(() => {
    setInsertModeActive(prev => !prev);
  }, []);

  const handleAddComment = useCallback((comment: string) => {
    if (editor) {
      const id = `comment-${Date.now()}`;
      editor.chain().focus().setMark('approverComment', { comment, id }).run();
    }
  }, [editor]);

  // Scroll to comment in editor
  const scrollToComment = useCallback((commentId: string) => {
    if (!editorContainerRef.current) return;

    const commentElement = editorContainerRef.current.querySelector(
      `span[data-comment-id="${commentId}"]`
    );

    if (commentElement) {
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight effect
      commentElement.classList.add('ring-2', 'ring-yellow-400');
      setTimeout(() => {
        commentElement.classList.remove('ring-2', 'ring-yellow-400');
      }, 2000);
    }
  }, []);

  const handleUpdateComment = useCallback((id: string, newText: string) => {
    if (editor) {
      const html = editor.getHTML();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const commentEl = doc.querySelector(`span[data-comment-id="${id}"]`);

      if (commentEl) {
        commentEl.setAttribute('data-comment', newText);
        commentEl.setAttribute('title', newText);
        editor.commands.setContent(doc.body.innerHTML);
      }

      setEditingComment(null);
      setEditCommentText('');
    }
  }, [editor]);

  const handleDeleteComment = useCallback((id: string) => {
    if (editor) {
      const html = editor.getHTML();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const commentEl = doc.querySelector(`span[data-comment-id="${id}"]`);

      if (commentEl) {
        const textNode = document.createTextNode(commentEl.textContent || '');
        commentEl.parentNode?.replaceChild(textNode, commentEl);
        editor.commands.setContent(doc.body.innerHTML);
      }
    }
  }, [editor]);

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

  const hasContent = editor ? editor.getHTML().length > 0 : false;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky toolbar */}
      {!readOnly && (
        <div className="sticky top-0 z-20 bg-[#0B1220]">
          <EditorToolbar
            editor={editor}
            insertModeActive={insertModeActive}
            onToggleInsertMode={handleToggleInsertMode}
            onAddComment={handleAddComment}
            onDownload={handleDownload}
            showDownload={hasContent}
          />
          {/* Insert mode indicator */}
          {insertModeActive && (
            <div className="bg-blue-500/20 border-b border-blue-500/30 px-3 py-1.5 text-xs text-blue-300 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              INSERT MODE ON - All text you type will appear in <span className="text-blue-400 underline font-bold">blue underline</span>
            </div>
          )}
        </div>
      )}

      {/* Editor content */}
      <div
        ref={editorContainerRef}
        className={`flex-1 bg-[#0B1220] ${!readOnly ? 'cursor-text' : ''}`}
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
