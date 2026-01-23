'use client';

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Strikethrough,
  Bold,
  MessageSquare,
  Undo2,
  Redo2,
  Download,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onAddComment: (comment: string) => void;
  onDownload?: () => void;
  showDownload?: boolean;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
}

export default function EditorToolbar({
  editor,
  onAddComment,
  onDownload,
  showDownload = false,
  zoomLevel = 100,
  onZoomChange,
}: EditorToolbarProps) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);

  const MIN_ZOOM = 50;
  const MAX_ZOOM = 200;
  const ZOOM_STEP = 10;

  const handleZoomIn = () => {
    if (onZoomChange && zoomLevel < MAX_ZOOM) {
      onZoomChange(Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM));
    }
  };

  const handleZoomOut = () => {
    if (onZoomChange && zoomLevel > MIN_ZOOM) {
      onZoomChange(Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM));
    }
  };

  const handleZoomReset = () => {
    if (onZoomChange) {
      onZoomChange(100);
    }
  };

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
  const activeClass = 'bg-blue-500/30 text-blue-400';
  const inactiveClass = 'bg-white/5 text-[#8FA3BF] hover:bg-white/10 hover:text-white';

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

  return (
    <div className="flex items-center gap-1 p-2 bg-[#0B1220] border-b border-white/10 relative">
      {/* Editing tools */}
      <div className="flex items-center gap-1 pr-2 border-r border-white/10">
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
      <div className="flex items-center gap-1 pl-2 pr-2 border-r border-white/10">
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
        <div className="flex items-center gap-1 pl-2 pr-2 border-r border-white/10">
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

      {/* Zoom Controls */}
      {onZoomChange && (
        <div className="flex items-center gap-1 pl-2 pr-2 border-r border-white/10">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= MIN_ZOOM}
            className={`${buttonBase} ${inactiveClass} disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs font-medium text-[#8FA3BF] hover:text-white transition-colors min-w-[48px] text-center"
            title="Reset zoom to 100%"
          >
            {zoomLevel}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= MAX_ZOOM}
            className={`${buttonBase} ${inactiveClass} disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="ml-auto flex items-center gap-3 text-xs text-[#8FA3BF]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-400/30 border border-red-400/50" />
          Strike
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-green-400/30 border border-green-400/50" />
          Add
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

      {/* Comment Input Popover */}
      {showCommentInput && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#1E293B] border border-white/20 rounded-lg shadow-xl p-3 w-80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Add Comment</span>
            <button
              type="button"
              onClick={() => {
                setShowCommentInput(false);
                setCommentText('');
              }}
              className="text-[#8FA3BF] hover:text-white"
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
            className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded text-white text-sm focus:outline-none focus:border-[#38BDF8]"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setShowCommentInput(false);
                setCommentText('');
              }}
              className="px-3 py-1 text-sm text-[#8FA3BF] hover:text-white"
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
