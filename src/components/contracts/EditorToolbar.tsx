'use client';

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Strikethrough,
  MessageSquare,
  Undo2,
  Redo2,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onAddComment: (comment: string) => void;
  onDownload?: () => void;
  showDownload?: boolean;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
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

  useEffect(() => {
    if (showCommentInput && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [showCommentInput]);

  if (!editor) return null;

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

  return (
    <div className="toolbar-glass h-14 mx-4 mt-4 px-4 flex items-center gap-2 relative">
      {/* Left: Edit tools */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark('approverStrike').run()}
          className={`tool-btn ${editor.isActive('approverStrike') ? 'active' : ''}`}
          title="Strikethrough"
        >
          <Strikethrough className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          onClick={handleCommentClick}
          className={`tool-btn ${editor.isActive('approverComment') ? 'active' : ''}`}
          title="Add comment"
        >
          <MessageSquare className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[var(--border-subtle)] mx-2" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="tool-btn disabled:opacity-30"
          title="Undo"
        >
          <Undo2 className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="tool-btn disabled:opacity-30"
          title="Redo"
        >
          <Redo2 className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Zoom + Export */}
      <div className="flex items-center gap-1">
        {onZoomChange && (
          <>
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP))}
              disabled={zoomLevel <= MIN_ZOOM}
              className="tool-btn disabled:opacity-30"
              title="Zoom out"
            >
              <ZoomOut className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(100)}
              className="px-2 h-8 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors min-w-[48px] font-medium"
              title="Reset zoom"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP))}
              disabled={zoomLevel >= MAX_ZOOM}
              className="tool-btn disabled:opacity-30"
              title="Zoom in"
            >
              <ZoomIn className="w-[18px] h-[18px]" />
            </button>
          </>
        )}

        {showDownload && onDownload && (
          <>
            <div className="w-px h-6 bg-[var(--border-subtle)] mx-2" />
            <button
              type="button"
              onClick={onDownload}
              className="tool-btn"
              title="Download"
            >
              <Download className="w-[18px] h-[18px]" />
            </button>
          </>
        )}
      </div>

      {/* Word/OneDrive Actions */}
      {onedriveEmbedUrl && (
        <>
          <div className="w-px h-6 bg-[var(--border-subtle)] mx-2" />
          <div className="flex items-center gap-2">
            {onRefreshFromWord && (
              <button
                type="button"
                onClick={onRefreshFromWord}
                disabled={refreshingFromWord}
                className="tool-btn"
                title="Sync from Word"
              >
                <RefreshCw className={`w-[18px] h-[18px] ${refreshingFromWord ? 'animate-spin' : ''}`} />
              </button>
            )}
            <a
              href={onedriveEmbedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 flex items-center gap-2 text-[12px] font-semibold text-[var(--accent-blue)] bg-[var(--surface-active)] hover:bg-[var(--accent-blue)]/20 rounded-lg transition-all duration-[180ms]"
              title="Edit in Word"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.17 3.25q.33 0 .59.25.24.24.24.58v15.84q0 .34-.24.58-.26.25-.59.25H7.83q-.33 0-.59-.25-.24-.24-.24-.58V17H2.83q-.33 0-.59-.24-.24-.25-.24-.59V7.83q0-.33.24-.59.26-.24.59-.24H7V4.08q0-.34.24-.58.26-.25.59-.25h13.34M7 13.06l1.18 2.22h1.79L8 12.06l1.93-3.17H8.22l-1.15 2.07h-.05l-1.14-2.07H4.09l1.9 3.18-2 3.22h1.78l1.24-2.23h.04M20 17V5H8v2h4.17q.33 0 .59.24.24.26.24.59v8.34q0 .33-.24.59-.26.24-.59.24H8v2h12z"/>
              </svg>
              <span>Edit in Word</span>
            </a>
          </div>
        </>
      )}

      {/* Comment Input Popover */}
      {showCommentInput && (
        <div className="absolute top-full left-4 mt-3 z-50 w-80 glass-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">Add Comment</span>
            <button
              type="button"
              onClick={() => { setShowCommentInput(false); setCommentText(''); }}
              className="tool-btn w-6 h-6"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={commentInputRef}
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommentSubmit();
              if (e.key === 'Escape') { setShowCommentInput(false); setCommentText(''); }
            }}
            placeholder="Enter your comment..."
            className="w-full h-10 px-4 text-[13px] input-pill mb-4"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowCommentInput(false); setCommentText(''); }}
              className="btn-surface px-4 h-9 text-[12px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommentSubmit}
              disabled={!commentText.trim()}
              className="btn-primary px-4 h-9 text-[12px] disabled:opacity-40"
            >
              Add Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
