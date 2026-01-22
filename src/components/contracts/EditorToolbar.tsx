'use client';

import { Editor } from '@tiptap/react';
import {
  Strikethrough,
  Underline,
  Bold,
  MessageSquare,
  Undo2,
  Redo2,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  const buttonBase =
    'p-2 rounded transition-colors flex items-center justify-center';
  const activeClass = 'bg-blue-500/30 text-blue-400';
  const inactiveClass = 'bg-white/5 text-[#8FA3BF] hover:bg-white/10 hover:text-white';

  return (
    <div className="flex items-center gap-1 p-2 bg-[#0B1220] border border-white/10 rounded-t-lg">
      {/* Editing tools */}
      <div className="flex items-center gap-1 pr-2 border-r border-white/10">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark('approverStrike').run()}
          className={`${buttonBase} ${
            editor.isActive('approverStrike') ? activeClass : inactiveClass
          }`}
          title="Strikethrough (marks for removal in blue)"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark('approverInsert').run()}
          className={`${buttonBase} ${
            editor.isActive('approverInsert') ? activeClass : inactiveClass
          }`}
          title="Underline (marks additions in blue)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${buttonBase} ${
            editor.isActive('bold') ? activeClass : inactiveClass
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark('approverComment').run()}
          className={`${buttonBase} ${
            editor.isActive('approverComment') ? activeClass : inactiveClass
          }`}
          title="Comment/Highlight (yellow)"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 pl-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={`${buttonBase} ${inactiveClass} disabled:opacity-30 disabled:cursor-not-allowed`}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={`${buttonBase} ${inactiveClass} disabled:opacity-30 disabled:cursor-not-allowed`}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="ml-auto flex items-center gap-3 text-xs text-[#8FA3BF]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-400/30 border border-red-400/50" />
          AI Remove
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-green-400/30 border border-green-400/50" />
          AI Add
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-400/30 border border-blue-400/50" />
          Your Edits
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-yellow-400/30 border border-yellow-400/50" />
          Comments
        </span>
      </div>
    </div>
  );
}
