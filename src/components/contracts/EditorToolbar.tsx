'use client';

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Strikethrough,
  Underline,
  Bold,
  MessageSquare,
  Undo2,
  Redo2,
  Download,
  X,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  insertModeActive: boolean;
  onToggleInsertMode: () => void;
  onAddComment: (comment: string) => void;
  onDownload?: () => void;
  showDownload?: boolean;
  paperMode?: boolean;
}

export default function EditorToolbar({
  editor,
  insertModeActive,
  onToggleInsertMode,
  onAddComment,
  onDownload,
  showDownload = false,
  paperMode = false,
}: EditorToolbarProps) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCommentInput && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [showCommentInput]);

  if (!editor) {
    return null;
  }

  const buttonBase =
    'p-2 rounded transition-colors flex items-center justify-center';
  const activeClass = paperMode
    ? 'bg-blue-100 text-blue-600'
    : 'bg-blue-500/30 text-blue-400';
  const inactiveClass = paperMode
    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
    : 'bg-white/5 text-[#8FA3BF] hover:bg-white/10 hover:text-white';
  const insertActiveClass = paperMode
    ? 'bg-blue-200 text-blue-700 ring-2 ring-blue-300'
    : 'bg-blue-500/50 text-blue-300 ring-2 ring-blue-400/50';

  const handleCommentClick = () => {
    const { from, to } = editor.state.selection;
    if (from === to) {
      alert('Please select text to add a comment');
      return;
    }
    setShowCommentInput(true);
  };

  const handleCommentSubmit = () => {
    if (commentText.trim()) {
      onAddComment(commentText.trim());
      setCommentText('');
      setShowCommentInput(false);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommentSubmit();
    } else if (e.key === 'Escape') {
      setShowCommentInput(false);
      setCommentText('');
    }
  };

  const containerClass = paperMode
    ? 'flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-200 relative'
    : 'flex items-center gap-1 p-2 bg-[#0B1220] border border-white/10 rounded-t-lg relative';

  const dividerClass = paperMode ? 'border-gray-200' : 'border-white/10';

  return (
    <div className={containerClass}>
      {/* Editing tools */}
      <div className={`flex items-center gap-1 pr-2 border-r ${dividerClass}`}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark('approverStrike').run()}
          className={`${buttonBase} ${
            editor.isActive('approverStrike') ? activeClass : inactiveClass
          }`}
          title="Strikethrough selected text (marks for removal in blue)"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleInsertMode}
          className={`${buttonBase} ${
            insertModeActive ? insertActiveClass : inactiveClass
          }`}
          title={insertModeActive ? "Insert mode ON - new text will be blue underlined" : "Click to enable insert mode for new text"}
        >
          <Underline className="w-4 h-4" />
          {insertModeActive && (
            <span className="ml-1 text-[10px] font-bold">ON</span>
          )}
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
          onClick={handleCommentClick}
          className={`${buttonBase} ${
            editor.isActive('approverComment') ? activeClass : inactiveClass
          }`}
          title="Add comment to selected text"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Undo/Redo */}
      <div className={`flex items-center gap-1 pl-2 pr-2 border-r ${dividerClass}`}>
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

      {/* Download */}
      {showDownload && onDownload && (
        <div className={`flex items-center gap-1 pl-2 pr-2 border-r ${dividerClass}`}>
          <button
            type="button"
            onClick={onDownload}
            className={`${buttonBase} ${inactiveClass}`}
            title="Download redlined document"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Legend */}
      <div className={`ml-auto flex items-center gap-3 text-xs ${paperMode ? 'text-gray-500' : 'text-[#8FA3BF]'}`}>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded-sm ${paperMode ? 'bg-red-100 border border-red-300' : 'bg-red-400/30 border border-red-400/50'}`} />
          Strike
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded-sm ${paperMode ? 'bg-green-100 border border-green-300' : 'bg-green-400/30 border border-green-400/50'}`} />
          Add
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded-sm ${paperMode ? 'bg-blue-100 border border-blue-300' : 'bg-blue-400/30 border border-blue-400/50'}`} />
          Your Edits
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded-sm ${paperMode ? 'bg-yellow-100 border border-yellow-300' : 'bg-yellow-400/30 border border-yellow-400/50'}`} />
          Comments
        </span>
      </div>

      {/* Comment Input Popover */}
      {showCommentInput && (
        <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg shadow-xl p-3 w-80 ${
          paperMode
            ? 'bg-white border border-gray-200'
            : 'bg-[#1E293B] border border-white/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${paperMode ? 'text-gray-900' : 'text-white'}`}>Add Comment</span>
            <button
              type="button"
              onClick={() => {
                setShowCommentInput(false);
                setCommentText('');
              }}
              className={paperMode ? 'text-gray-400 hover:text-gray-600' : 'text-[#8FA3BF] hover:text-white'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={commentInputRef}
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleCommentKeyDown}
            placeholder="Enter your comment..."
            className={`w-full px-3 py-2 rounded text-sm focus:outline-none ${
              paperMode
                ? 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-400'
                : 'bg-[#0B1220] border border-white/10 text-white focus:border-[#38BDF8]'
            }`}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setShowCommentInput(false);
                setCommentText('');
              }}
              className={`px-3 py-1 text-sm ${
                paperMode ? 'text-gray-500 hover:text-gray-700' : 'text-[#8FA3BF] hover:text-white'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommentSubmit}
              disabled={!commentText.trim()}
              className="px-3 py-1 text-sm bg-[#38BDF8] text-white rounded hover:bg-[#38BDF8]/80 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
