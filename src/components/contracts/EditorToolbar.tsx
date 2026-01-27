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

  // Icon button base style - minimal
  const iconBtn = "w-8 h-8 flex items-center justify-center rounded-[8px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-[180ms] disabled:opacity-30";
  const iconBtnActive = "w-8 h-8 flex items-center justify-center rounded-[8px] text-[#58A6FF] bg-[#58A6FF]/10";

  return (
    <div className="h-11 px-5 flex items-center gap-4 border-b border-white/[0.04] relative">
      {/* Left: Document name area (can be customized) */}
      <div className="flex-1 flex items-center gap-2">
        {/* Edit tools - muted */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleMark('approverStrike').run()}
            className={editor.isActive('approverStrike') ? iconBtnActive : iconBtn}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCommentClick}
            className={editor.isActive('approverComment') ? iconBtnActive : iconBtn}
            title="Add comment"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-white/[0.06] mx-1" />

        <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className={iconBtn}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className={iconBtn}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Zoom + Export */}
      <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
        {onZoomChange && (
          <>
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP))}
              disabled={zoomLevel <= MIN_ZOOM}
              className={iconBtn}
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(100)}
              className="px-2 h-8 text-[11px] text-white/50 hover:text-white/70 transition-colors min-w-[42px]"
              title="Reset zoom"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP))}
              disabled={zoomLevel >= MAX_ZOOM}
              className={iconBtn}
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </>
        )}

        {showDownload && onDownload && (
          <button type="button" onClick={onDownload} className={iconBtn} title="Download">
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Word/OneDrive Actions */}
      {onedriveEmbedUrl && (
        <div className="flex items-center gap-2 pl-3 border-l border-white/[0.04]">
          {onRefreshFromWord && (
            <button
              type="button"
              onClick={onRefreshFromWord}
              disabled={refreshingFromWord}
              className={iconBtn}
              title="Sync from Word"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingFromWord ? 'animate-spin' : ''}`} />
            </button>
          )}
          <a
            href={onedriveEmbedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 flex items-center gap-1.5 text-[12px] font-medium text-white/70 bg-white/[0.04] hover:bg-white/[0.06] rounded-[8px] transition-all duration-[180ms]"
            title="Edit in Word"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.17 3.25q.33 0 .59.25.24.24.24.58v15.84q0 .34-.24.58-.26.25-.59.25H7.83q-.33 0-.59-.25-.24-.24-.24-.58V17H2.83q-.33 0-.59-.24-.24-.25-.24-.59V7.83q0-.33.24-.59.26-.24.59-.24H7V4.08q0-.34.24-.58.26-.25.59-.25h13.34M7 13.06l1.18 2.22h1.79L8 12.06l1.93-3.17H8.22l-1.15 2.07h-.05l-1.14-2.07H4.09l1.9 3.18-2 3.22h1.78l1.24-2.23h.04M20 17V5H8v2h4.17q.33 0 .59.24.24.26.24.59v8.34q0 .33-.24.59-.26.24-.59.24H8v2h12z"/>
            </svg>
            <span>Word</span>
          </a>
        </div>
      )}

      {/* Comment Input Popover */}
      {showCommentInput && (
        <div className="absolute top-full left-4 mt-2 z-50 w-72 p-4 rounded-[14px] bg-[#0C0C0E] border border-white/[0.08] shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-white/80">Add Comment</span>
            <button
              type="button"
              onClick={() => { setShowCommentInput(false); setCommentText(''); }}
              className="p-1 rounded text-white/40 hover:text-white/70 transition-colors"
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
            placeholder="Enter comment..."
            className="w-full h-9 px-4 text-[13px] input-pill mb-3"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowCommentInput(false); setCommentText(''); }}
              className="px-3 h-8 text-[12px] font-medium text-white/50 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommentSubmit}
              disabled={!commentText.trim()}
              className="px-4 h-8 text-[12px] font-medium text-white bg-[#58A6FF] hover:bg-[#58A6FF]/90 rounded-[8px] transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
