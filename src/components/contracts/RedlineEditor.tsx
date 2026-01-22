'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { Mark, mergeAttributes } from '@tiptap/core';
import EditorToolbar from './EditorToolbar';
import { useCallback, useEffect } from 'react';

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

// Custom mark for approver comments (yellow highlight)
const ApproverComment = Mark.create({
  name: 'approverComment',

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
        style: 'background-color: rgba(250, 204, 21, 0.3); padding: 0 2px; border-radius: 2px;',
      }),
      0,
    ];
  },
});

// Helper to convert redline markup to HTML with proper styling
function formatRedlinesToHTML(text: string): string {
  // Convert AI redline markup to styled HTML
  return text
    // AI strikethrough (red) - remove markers
    .replace(
      /\[strikethrough\](.*?)\[\/strikethrough\]/g,
      '<del style="color: #f87171; text-decoration: line-through;">$1</del>'
    )
    // AI underline/additions (green)
    .replace(
      /\[underline\](.*?)\[\/underline\]/g,
      '<ins style="color: #4ade80; text-decoration: underline;">$1</ins>'
    )
    // Alternative markdown-style markers
    .replace(
      /~~(.*?)~~/g,
      '<del style="color: #f87171; text-decoration: line-through;">$1</del>'
    )
    .replace(
      /\+\+(.*?)\+\+/g,
      '<ins style="color: #4ade80; text-decoration: underline;">$1</ins>'
    )
    // Preserve line breaks
    .replace(/\n/g, '<br>');
}

// Helper to convert approver-edited HTML back to storable format
function htmlToStorableFormat(html: string): string {
  // Preserve the HTML with approver marks for storage
  return html;
}

interface RedlineEditorProps {
  initialContent: string;
  approverEditedContent?: string | null;
  onChange?: (html: string) => void;
  readOnly?: boolean;
}

export default function RedlineEditor({
  initialContent,
  approverEditedContent,
  onChange,
  readOnly = false,
}: RedlineEditorProps) {
  // Use approver-edited content if available, otherwise format the original redlines
  const contentToUse = approverEditedContent || formatRedlinesToHTML(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default strike to use our custom one
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
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(htmlToStorableFormat(editor.getHTML()));
      }
    },
  });

  // Update content when initialContent changes (e.g., after reload)
  useEffect(() => {
    if (editor && approverEditedContent) {
      editor.commands.setContent(approverEditedContent);
    }
  }, [editor, approverEditedContent]);

  const handleEditorClick = useCallback(() => {
    editor?.chain().focus().run();
  }, [editor]);

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      {!readOnly && <EditorToolbar editor={editor} />}
      <div
        className={`bg-[#0B1220] ${!readOnly ? 'cursor-text' : ''} max-h-[500px] overflow-y-auto`}
        onClick={handleEditorClick}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
