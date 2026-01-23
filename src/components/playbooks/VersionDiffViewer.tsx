'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Minus, Plus, FileText } from 'lucide-react';

interface DiffStats {
  deletions: number;
  insertions: number;
  unchanged: number;
  totalChanges: number;
}

interface VersionInfo {
  version: number;
  created_at: string;
  created_by: string | null;
  change_notes: string | null;
}

interface VersionDiffViewerProps {
  playbookId: string;
  fromVersion: number;
  toVersion: number;
  onClose: () => void;
}

export default function VersionDiffViewer({
  playbookId,
  fromVersion,
  toVersion,
  onClose,
}: VersionDiffViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<[number, string][]>([]);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const [fromVersionInfo, setFromVersionInfo] = useState<VersionInfo | null>(null);
  const [toVersionInfo, setToVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetchDiff();
  }, [playbookId, fromVersion, toVersion]);

  async function fetchDiff() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/playbooks/${playbookId}/diff?from=${fromVersion}&to=${toVersion}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch diff');
      }

      const data = await response.json();
      setDiffs(data.diffs);
      setStats(data.stats);
      setFromVersionInfo(data.fromVersion);
      setToVersionInfo(data.toVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function renderDiff() {
    return diffs.map((diff, idx) => {
      const [type, text] = diff;

      if (type === -1) {
        // Deletion
        return (
          <span
            key={idx}
            className="bg-red-500/20 text-red-300 line-through decoration-red-400"
          >
            {text}
          </span>
        );
      } else if (type === 1) {
        // Insertion
        return (
          <span key={idx} className="bg-green-500/20 text-green-300">
            {text}
          </span>
        );
      } else {
        // Unchanged
        return <span key={idx}>{text}</span>;
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#151F2E] border border-white/10 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#A78BFA]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Version Comparison</h3>
              <p className="text-xs text-[#8FA3BF]">
                Comparing v{fromVersion} → v{toVersion}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 text-[#8FA3BF] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Bar */}
        {stats && !loading && (
          <div className="flex items-center gap-6 px-6 py-3 bg-[#0B1220] border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-medium">
                +{stats.insertions} characters added
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400 font-medium">
                -{stats.deletions} characters removed
              </span>
            </div>
            <div className="text-sm text-[#64748B]">
              {stats.totalChanges} total changes
            </div>
          </div>
        )}

        {/* Version Info */}
        {fromVersionInfo && toVersionInfo && !loading && (
          <div className="grid grid-cols-2 gap-4 px-6 py-3 border-b border-white/10 flex-shrink-0">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                  v{fromVersionInfo.version}
                </span>
                <span className="text-xs text-[#64748B]">
                  {formatDate(fromVersionInfo.created_at)}
                </span>
              </div>
              {fromVersionInfo.change_notes && (
                <p className="text-xs text-[#8FA3BF] truncate">
                  {fromVersionInfo.change_notes}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
                  v{toVersionInfo.version}
                </span>
                <span className="text-xs text-[#64748B]">
                  {formatDate(toVersionInfo.created_at)}
                </span>
              </div>
              {toVersionInfo.change_notes && (
                <p className="text-xs text-[#8FA3BF] truncate">
                  {toVersionInfo.change_notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">{error}</p>
            </div>
          ) : diffs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#8FA3BF]">No differences found between versions</p>
            </div>
          ) : (
            <div className="bg-[#0B1220] border border-white/10 rounded-lg p-6">
              <pre className="text-sm text-[#CBD5E1] whitespace-pre-wrap font-mono leading-relaxed">
                {renderDiff()}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
