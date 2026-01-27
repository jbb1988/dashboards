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
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onAddComment: (comment: string) => void;
  onDownload?: () => void;
  showDownload?: boolean;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
  // OneDrive integration
  onedriveEmbedUrl?: string | null;
  onedriveWebUrl?: string | null;
  onRefreshFromWord?: () => void;
  refreshingFromWord?: boolean;
}

export default function EditorToolbar({
  editor,
  onAddComment,
  onDownload,
  showDownload = false,
  zoomLevel = 100,
  onZoomChange,
  onedriveEmbedUrl,
  onedriveWebUrl,
  onRefreshFromWord,
  refreshingFromWord = false,
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
  const activeClass = 'bg-[#58A6FF]/30 text-[#58A6FF]';
  const inactiveClass = 'bg-white/5 text-[rgba(255,255,255,0.62)] hover:bg-white/10 hover:text-[rgba(255,255,255,0.88)]';

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
    <div className="flex items-center gap-2 px-5 py-3 bg-[var(--approval-bg-surface)] border-b border-white/5 relative rounded-t-xl">
      {/* Zone 1: Review Actions (Primary - colored) */}
      <div className="flex items-center gap-2.5 pr-5 border-r border-white/8">
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

      {/* Zone 2: Edit Tools (Secondary - muted until hover) */}
      <div className="flex items-center gap-1.5 px-4 opacity-50 hover:opacity-100 transition-opacity">
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

      {/* Zone 3: Utility (Tertiary - far right, subtle) */}
      <div className="ml-auto flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
        {/* Zoom Controls */}
        {onZoomChange && (
          <div className="flex items-center gap-1 pr-3 border-r border-white/10">
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
              className="px-2 py-1 text-xs font-medium text-[rgba(255,255,255,0.55)] hover:text-[rgba(255,255,255,0.88)] transition-colors min-w-[48px] text-center"
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

        {/* Download */}
        {showDownload && onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className={`${buttonBase} ${inactiveClass}`}
            title="Download redlined document"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Word/OneDrive Actions */}
      {onedriveEmbedUrl && (
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          {onRefreshFromWord && (
            <button
              type="button"
              onClick={onRefreshFromWord}
              disabled={refreshingFromWord}
              className={`${buttonBase} ${inactiveClass} disabled:opacity-50`}
              title="Sync changes from Word Online"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingFromWord ? 'animate-spin' : ''}`} />
            </button>
          )}
          {onedriveWebUrl && (
            <a
              href={onedriveWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonBase} ${inactiveClass}`}
              title="Download Word document"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
          <a
            href={onedriveEmbedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2B579A] hover:bg-[#1E3F6F] text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            title="Open and edit in Word Online"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.17 3.25q.33 0 .59.25.24.24.24.58v15.84q0 .34-.24.58-.26.25-.59.25H7.83q-.33 0-.59-.25-.24-.24-.24-.58V17H2.83q-.33 0-.59-.24-.24-.25-.24-.59V7.83q0-.33.24-.59.26-.24.59-.24H7V4.08q0-.34.24-.58.26-.25.59-.25h13.34M7 13.06l1.18 2.22h1.79L8 12.06l1.93-3.17H8.22l-1.15 2.07h-.05l-1.14-2.07H4.09l1.9 3.18-2 3.22h1.78l1.24-2.23h.04M20 17V5H8v2h4.17q.33 0 .59.24.24.26.24.59v8.34q0 .33-.24.59-.26.24-.59.24H8v2h12z"/>
            </svg>
            Edit in Word
          </a>
        </div>
      )}

      {/* Legend - minimal */}
      <div className="hidden lg:flex items-center gap-4 text-[9px] text-[rgba(255,255,255,0.35)] pl-5 border-l border-white/5 uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#f87171]/40" />
          Remove
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#4ade80]/40" />
          Add
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#60A5FA]/40" />
          Yours
        </span>
      </div>

      {/* Comment Input Popover */}
      {showCommentInput && (
        <div className="absolute top-full left-4 mt-2 z-50 glass-panel rounded-xl shadow-2xl p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">Add Comment</span>
            <button
              type="button"
              onClick={() => {
                setShowCommentInput(false);
                setCommentText('');
              }}
              className="p-1 rounded-md text-[rgba(255,255,255,0.55)] hover:text-[rgba(255,255,255,0.88)] hover:bg-white/5 transition-all"
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
            className="w-full px-3 py-2.5 bg-[var(--approval-bg-base)] border border-white/10 rounded-lg text-[rgba(255,255,255,0.88)] text-sm focus:outline-none focus:border-[#58A6FF] focus:ring-1 focus:ring-[#58A6FF]/30 placeholder:text-[rgba(255,255,255,0.35)] transition-all"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                setShowCommentInput(false);
                setCommentText('');
              }}
              className="px-3 py-1.5 text-sm font-medium text-[rgba(255,255,255,0.55)] hover:text-[rgba(255,255,255,0.88)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommentSubmit}
              disabled={!commentText.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-[#58A6FF] text-white rounded-lg hover:bg-[#58A6FF]/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
