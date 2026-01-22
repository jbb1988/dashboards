'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark, mergeAttributes, Extension } from '@tiptap/core';
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
      { style: 'text-decoration: line-through', consuming: false },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ai-strike': '',
        style: 'color: #f87171; text-decoration: line-through;',
      }),
      0,
    ];
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
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ai-insert': '',
        style: 'color: #4ade80; text-decoration: underline;',
      }),
      0,
    ];
  },
});

// Custom mark for approver strikethrough (blue)
const ApproverStrike = Mark.create({
  name: 'approverStrike',

  parseHTML() {
    return [
      { tag: 'span[data-approver-strike]' },
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
      { tag: 'span[data-approver-insert]' },
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

// Custom mark for approver comments (yellow highlight with data)
const ApproverComment = Mark.create({
  name: 'approverComment',

  addAttributes() {
    return {
      comment: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-comment') || '',
        renderHTML: (attributes) => ({
          'data-comment': attributes.comment || '',
        }),
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => ({
          'data-comment-id': attributes.id || '',
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-approver-comment]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-approver-comment': '',
        class: 'approver-comment',
        style: 'background-color: rgba(250, 204, 21, 0.3); padding: 0 2px; border-radius: 2px; cursor: pointer;',
      }),
      0,
    ];
  },
});

// Extension to handle insert mode
const InsertMode = Extension.create({
  name: 'insertMode',

  addStorage() {
    return {
      active: false,
    };
  },

  addKeyboardShortcuts() {
    return {
      // Capture all printable characters when insert mode is active
    };
  },
});

// Helper to convert redline markup to HTML with proper custom tags
function formatRedlinesToHTML(text: string): string {
  return text
    // Convert [strikethrough] markers to our custom span
    .replace(
      /\[strikethrough\]([\s\S]*?)\[\/strikethrough\]/g,
      '<span data-ai-strike style="color: #f87171; text-decoration: line-through;">$1</span>'
    )
    // Convert [underline] markers to our custom span
    .replace(
      /\[underline\]([\s\S]*?)\[\/underline\]/g,
      '<span data-ai-insert style="color: #4ade80; text-decoration: underline;">$1</span>'
    )
    // Convert ~~ markers to strike
    .replace(
      /~~([\s\S]*?)~~/g,
      '<span data-ai-strike style="color: #f87171; text-decoration: line-through;">$1</span>'
    )
    // Convert ++ markers to insert
    .replace(
      /\+\+([\s\S]*?)\+\+/g,
      '<span data-ai-insert style="color: #4ade80; text-decoration: underline;">$1</span>'
    )
    // Preserve line breaks
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
    span[data-ai-strike] { color: #dc2626; text-decoration: line-through; }
    span[data-ai-insert] { color: #16a34a; text-decoration: underline; }
    span[data-approver-strike] { color: #2563eb; text-decoration: line-through; }
    span[data-approver-insert] { color: #2563eb; text-decoration: underline; }
    span[data-approver-comment] { background-color: rgba(250, 204, 21, 0.4); padding: 0 2px; border-radius: 2px; }
    span[data-approver-comment]::after { content: " [Comment: " attr(data-comment) "]"; font-size: 10pt; color: #666; font-style: italic; }
    .legend { margin-bottom: 30px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
    .legend h3 { margin: 0 0 10px 0; font-size: 14pt; }
    .legend-item { display: inline-block; margin-right: 20px; font-size: 11pt; }
    h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .generated { font-size: 10pt; color: #666; margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>${contractName} - Redlined Document</h1>
  <div class="legend">
    <h3>Legend</h3>
    <span class="legend-item"><span style="color: #dc2626; text-decoration: line-through;">Red Strike</span> = Original to Remove</span>
    <span class="legend-item"><span style="color: #16a34a; text-decoration: underline;">Green Underline</span> = Original to Add</span>
    <span class="legend-item"><span style="color: #2563eb; text-decoration: line-through;">Blue Strike</span> = Approver Remove</span>
    <span class="legend-item"><span style="color: #2563eb; text-decoration: underline;">Blue Underline</span> = Approver Add</span>
    <span class="legend-item"><span style="background-color: rgba(250, 204, 21, 0.4); padding: 0 4px;">Yellow</span> = Comment</span>
  </div>
  <div class="content">${content}</div>
  <div class="generated">Generated on ${new Date().toLocaleString()}</div>
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
  const insertModeRef = useRef(insertModeActive);

  useEffect(() => {
    insertModeRef.current = insertModeActive;
  }, [insertModeActive]);

  const contentToUse = approverEditedContent || formatRedlinesToHTML(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        strike: false,
      }),
      AIStrike,
      AIInsert,
      ApproverStrike,
      ApproverInsert,
      ApproverComment,
      InsertMode,
    ],
    content: contentToUse,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] text-white text-sm font-mono whitespace-pre-wrap leading-relaxed p-4',
      },
      handleTextInput: (view, from, to, text) => {
        // When insert mode is active, wrap new text in approverInsert mark
        if (insertModeRef.current && text) {
          const { state } = view;
          const insertMarkType = state.schema.marks.approverInsert;
          if (insertMarkType) {
            const tr = state.tr.insertText(text, from, to);
            tr.addMark(from, from + text.length, insertMarkType.create());
            view.dispatch(tr);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
      // Extract comments from content
      extractComments(editor.getHTML());
    },
  });

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
      if (text) {
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

  const handleUpdateComment = useCallback((id: string, newText: string) => {
    if (editor) {
      // Find and update the comment in the document
      const html = editor.getHTML();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const commentEl = doc.querySelector(`span[data-comment-id="${id}"]`);

      if (commentEl) {
        commentEl.setAttribute('data-comment', newText);
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
        // Replace the comment span with just its text content
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
        <div className="bg-blue-500/20 border-b border-blue-500/30 px-3 py-1.5 text-xs text-blue-300 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          Insert mode ON - text you type will appear in blue underline
        </div>
      )}

      <div className="flex">
        {/* Editor */}
        <div
          className={`flex-1 bg-[#0B1220] ${!readOnly ? 'cursor-text' : ''} max-h-[500px] overflow-y-auto`}
          onClick={handleEditorClick}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Comments sidebar */}
        {comments.length > 0 && (
          <div className="w-64 bg-[#0D1520] border-l border-white/10 max-h-[500px] overflow-y-auto">
            <div className="p-3 border-b border-white/10">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments ({comments.length})
              </h4>
            </div>
            <div className="p-2 space-y-2">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 text-xs"
                >
                  <div className="text-yellow-200/70 truncate mb-1 italic">
                    &ldquo;{comment.highlightedText.slice(0, 30)}...&rdquo;
                  </div>
                  {editingComment === comment.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        className="w-full px-2 py-1 bg-[#0B1220] border border-white/20 rounded text-white text-xs"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleUpdateComment(comment.id, editCommentText)}
                          className="flex-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingComment(null);
                            setEditCommentText('');
                          }}
                          className="px-2 py-1 text-gray-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-white mb-2">{comment.text}</div>
                      {!readOnly && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingComment(comment.id);
                              setEditCommentText(comment.text);
                            }}
                            className="p-1 text-gray-400 hover:text-white"
                            title="Edit comment"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 text-gray-400 hover:text-red-400"
                            title="Delete comment"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
