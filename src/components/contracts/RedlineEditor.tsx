'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark, mergeAttributes } from '@tiptap/core';
import EditorToolbar from './EditorToolbar';
import { useCallback, useEffect, useState, useRef } from 'react';

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

// Helper to convert redline markup to HTML
function formatRedlinesToHTML(text: string): string {
  return text
    // Handle HTML tags from diff-match-patch (must come first before other replacements)
    .replace(/<del>([\s\S]*?)<\/del>/g,
      '<span data-ai-strike style="color: #f87171; text-decoration: line-through;">$1</span>')
    .replace(/<ins>([\s\S]*?)<\/ins>/g,
      '<span data-ai-insert style="color: #4ade80; text-decoration: underline;">$1</span>')
    // Handle custom markup formats
    .replace(/\[strikethrough\]([\s\S]*?)\[\/strikethrough\]/g,
      '<span data-ai-strike style="color: #f87171; text-decoration: line-through;">$1</span>')
    .replace(/\[underline\]([\s\S]*?)\[\/underline\]/g,
      '<span data-ai-insert style="color: #4ade80; text-decoration: underline;">$1</span>')
    // Handle markdown-style syntax
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
  // OneDrive integration
  onedriveEmbedUrl?: string | null;
  onedriveWebUrl?: string | null;
  onRefreshFromWord?: () => void;
  refreshingFromWord?: boolean;
}

export default function RedlineEditor({
  initialContent,
  approverEditedContent,
  onChange,
  readOnly = false,
  contractName = 'Contract',
  onedriveEmbedUrl,
  onedriveWebUrl,
  onRefreshFromWord,
  refreshingFromWord = false,
}: RedlineEditorProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [zoomLevel, setZoomLevel] = useState(100);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const contentToUse = approverEditedContent || formatRedlinesToHTML(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ strike: false }),
      AIStrike,
      AIInsert,
      ApproverStrike,
      ApproverInsert,
      ApproverComment,
    ],
    content: contentToUse,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[calc(100vh-180px)] text-white text-sm font-mono whitespace-pre-wrap leading-relaxed p-6',
      },
      // Always apply approverInsert mark to typed text (blue underline)
      handleTextInput: (view, from, to, text) => {
        const { state } = view;
        const markType = state.schema.marks.approverInsert;
        if (!markType) return false;

        const tr = state.tr.insertText(text, from, to);
        tr.addMark(from, from + text.length, markType.create());
        view.dispatch(tr);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
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

  const handleAddComment = useCallback((comment: string) => {
    if (editor) {
      const id = `comment-${Date.now()}`;
      editor.chain().focus().setMark('approverComment', { comment, id }).run();
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
    <div
      ref={scrollContainerRef}
      className="h-[calc(100vh-60px)] overflow-y-auto bg-[#1B1F24]"
    >
      {/* Sticky toolbar - sticks within the scroll container */}
      {!readOnly && (
        <div className="sticky top-0 z-20 bg-[#1B1F24]">
          <EditorToolbar
            editor={editor}
            onAddComment={handleAddComment}
            onDownload={handleDownload}
            showDownload={hasContent}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onedriveEmbedUrl={onedriveEmbedUrl}
            onedriveWebUrl={onedriveWebUrl}
            onRefreshFromWord={onRefreshFromWord}
            refreshingFromWord={refreshingFromWord}
          />
        </div>
      )}

      {/* Editor content */}
      <div
        className={`bg-[#1B1F24] ${!readOnly ? 'cursor-text' : ''} overflow-x-auto`}
        onClick={handleEditorClick}
      >
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
            width: `${10000 / zoomLevel}%`,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Read-only toolbar with zoom and download */}
      {readOnly && hasContent && (
        <div className="sticky bottom-0 bg-[#1B1F24] border-t border-white/10 px-4 py-2 flex items-center justify-between">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
              disabled={zoomLevel <= 50}
              className="p-1.5 rounded bg-white/5 text-[#8FA3BF] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="px-2 py-1 text-xs font-medium text-[#8FA3BF] hover:text-white transition-colors min-w-[48px] text-center"
              title="Reset zoom to 100%"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
              disabled={zoomLevel >= 200}
              className="p-1.5 rounded bg-white/5 text-[#8FA3BF] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
          </div>

          {/* Download Button */}
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
