'use client';

import { useState, useEffect, use, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import {
  DashboardBackground,
  backgroundPresets,
  tokens,
} from '@/components/mars-ui';

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  current_version: number;
  content: string;
  created_at: string;
  updated_at: string;
}

interface PlaybookVersion {
  id: string;
  playbook_id: string;
  version: number;
  content: string;
  change_notes: string | null;
  created_by: string | null;
  created_at: string;
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
}

export default function PlaybookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [versions, setVersions] = useState<PlaybookVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showVersionPanel, setShowVersionPanel] = useState(true);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersion, setNewVersion] = useState({ content: '', changeNotes: '', versionNumber: '' });
  const [creating, setCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // File upload state
  const [uploadMode, setUploadMode] = useState<'file' | 'paste'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPlaybook();
  }, [resolvedParams.id]);

  async function fetchPlaybook() {
    try {
      const response = await fetch(`/api/playbooks/${resolvedParams.id}`);
      if (!response.ok) {
        router.push('/playbooks');
        return;
      }
      const data = await response.json();
      setPlaybook(data.playbook);
      setVersions(data.versions || []);
      setSelectedVersion(data.playbook.current_version);
    } catch (error) {
      console.error('Failed to fetch playbook:', error);
      router.push('/playbooks');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateVersion() {
    if (uploadMode === 'paste' && !newVersion.content.trim()) return;
    if (uploadMode === 'file' && !selectedFile) return;

    setCreating(true);
    setUploadError(null);

    try {
      if (uploadMode === 'file' && selectedFile) {
        // Upload file
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('changeNotes', newVersion.changeNotes.trim() || '');
        formData.append('createdBy', 'admin@mars.com'); // TODO: Get from session
        if (newVersion.versionNumber.trim()) {
          formData.append('versionNumber', newVersion.versionNumber.trim());
        }

        const response = await fetch(`/api/playbooks/${resolvedParams.id}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }
      } else {
        // Paste text
        const response = await fetch(`/api/playbooks/${resolvedParams.id}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newVersion.content.trim(),
            changeNotes: newVersion.changeNotes.trim() || null,
            createdBy: 'admin@mars.com',
            versionNumber: newVersion.versionNumber.trim() || null,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create version');
        }
      }

      setShowNewVersionModal(false);
      setNewVersion({ content: '', changeNotes: '', versionNumber: '' });
      setSelectedFile(null);
      setUploadMode('file');
      fetchPlaybook();
    } catch (error) {
      console.error('Failed to create version:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to create version');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    try {
      const response = await fetch(`/api/playbooks/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/playbooks');
      }
    } catch (error) {
      console.error('Failed to delete playbook:', error);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  function validateAndSetFile(file: File) {
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      setUploadError('Please upload a PDF, Word (.docx/.doc), or text file');
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileIcon(fileType: string | null) {
    switch (fileType) {
      case 'pdf':
        return (
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.5 17.5h-1v-3h1a1.5 1.5 0 0 1 0 3zm5-1h-.5v1h-1v-4h1.5a1.5 1.5 0 0 1 0 3zm4-2h-2v1h1.5v1H16.5v1h-1v-4h2.5v1zM14 9V3.5L19.5 9H14z" />
          </svg>
        );
      case 'docx':
      case 'doc':
        return (
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM15.2 18H14l-1-3.3-1 3.3H10.8L9 13h1.3l.9 3.4 1-3.4h1.1l1 3.4.9-3.4H16l-1.8 5zM14 9V3.5L19.5 9H14z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  }

  async function downloadVersion(versionId: string, fileName: string) {
    try {
      const response = await fetch(`/api/playbooks/${resolvedParams.id}/download?versionId=${versionId}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }

  const currentVersionContent = versions.find(v => v.version === selectedVersion)?.content || playbook?.content || '';
  const selectedVersionData = versions.find(v => v.version === selectedVersion);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1722] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8FA3BF]">Loading playbook...</p>
        </div>
      </div>
    );
  }

  if (!playbook) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0F1722] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.admin} />

      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.div
        className="relative z-10 text-white"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header */}
        <header className="border-b border-white/[0.06] bg-[#0F1722]/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.3)] sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/playbooks')}
                  className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#2D3B4F] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-[20px] font-semibold text-white">{playbook.name}</h1>
                  <p className="text-[12px] text-[#8FA3BF] mt-1">
                    {playbook.description || 'No description'}
                    <span className="ml-2 px-2 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A78BFA] text-[10px] font-medium">
                      v{playbook.current_version}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowVersionPanel(!showVersionPanel)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    showVersionPanel
                      ? 'bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30'
                      : 'bg-[#1E293B] text-[#8FA3BF] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Version History
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setNewVersion({ content: currentVersionContent, changeNotes: '', versionNumber: '' });
                    setSelectedFile(null);
                    setUploadMode('file');
                    setUploadError(null);
                    setShowNewVersionModal(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-sm text-white font-medium hover:bg-[#7C3AED] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Version
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </motion.button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex">
          {/* Document Content */}
          <main className={`flex-1 max-w-[1600px] mx-auto px-8 py-6 transition-all ${showVersionPanel ? 'mr-80' : ''}`}>
            {/* Version Info Bar */}
            {selectedVersionData && (
              <div className="mb-4 p-3 rounded-lg bg-[#1E293B] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded bg-[#8B5CF6]/20 text-[#A78BFA] font-medium">
                    v{selectedVersionData.version}
                  </span>
                  <span className="text-sm text-[#8FA3BF]">
                    {new Date(selectedVersionData.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {selectedVersionData.created_by && (
                    <span className="text-sm text-[#64748B]">
                      by {selectedVersionData.created_by}
                    </span>
                  )}
                  {selectedVersionData.file_name && (
                    <button
                      onClick={() => downloadVersion(selectedVersionData.id, selectedVersionData.file_name!)}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-white/5 text-[#8FA3BF] hover:text-white hover:bg-white/10 transition-colors"
                    >
                      {getFileIcon(selectedVersionData.file_type)}
                      <span>{selectedVersionData.file_name}</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  )}
                </div>
                {selectedVersionData.change_notes && (
                  <span className="text-sm text-[#8FA3BF] italic">
                    &ldquo;{selectedVersionData.change_notes}&rdquo;
                  </span>
                )}
              </div>
            )}

            {/* Content Display */}
            <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Agreement Content</span>
                <button
                  onClick={() => navigator.clipboard.writeText(currentVersionContent)}
                  className="text-xs px-2 py-1 rounded bg-white/5 text-[#8FA3BF] hover:text-white transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="p-6 max-h-[calc(100vh-280px)] overflow-y-auto">
                {currentVersionContent ? (
                  <pre className="text-sm text-[#CBD5E1] whitespace-pre-wrap font-mono leading-relaxed">
                    {currentVersionContent}
                  </pre>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-[#64748B] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-[#8FA3BF]">No content yet</p>
                    <p className="text-sm text-[#64748B] mt-1">Click &ldquo;New Version&rdquo; to add content</p>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Version History Panel */}
          {showVersionPanel && (
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              className="fixed right-0 top-[73px] bottom-0 w-80 bg-[#151F2E] border-l border-white/10 overflow-y-auto"
            >
              <div className="p-4 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Version History</h3>
                <p className="text-xs text-[#64748B] mt-1">{versions.length} version(s)</p>
              </div>

              <div className="p-4 space-y-3">
                {versions.length === 0 ? (
                  <p className="text-sm text-[#64748B] text-center py-8">No versions yet</p>
                ) : (
                  versions.map((version) => (
                    <motion.div
                      key={version.id}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedVersion === version.version
                          ? 'bg-[#8B5CF6]/20 border border-[#8B5CF6]/30'
                          : 'bg-[#0B1220] border border-white/5 hover:border-white/10'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedVersion(version.version)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium ${
                            selectedVersion === version.version ? 'text-[#A78BFA]' : 'text-white'
                          }`}>
                            Version {version.version}
                          </span>
                          {version.version === playbook.current_version && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8FA3BF]">
                          {new Date(version.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        {version.change_notes && (
                          <p className="text-xs text-[#64748B] mt-1 truncate">
                            {version.change_notes}
                          </p>
                        )}
                      </button>

                      {/* File download button */}
                      {version.file_name && version.file_path && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadVersion(version.id, version.file_name!);
                          }}
                          className="mt-2 w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-white/5 text-[#8FA3BF] hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {getFileIcon(version.file_type)}
                          <span className="truncate flex-1 text-left">{version.file_name}</span>
                          {version.file_size && (
                            <span className="text-[#64748B]">{formatFileSize(version.file_size)}</span>
                          )}
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </motion.aside>
          )}
        </div>
      </motion.div>

      {/* New Version Modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-white mb-4">Create New Version</h3>

            {/* Upload Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUploadMode('file')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === 'file'
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-white/5 text-[#8FA3BF] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload File
                </div>
              </button>
              <button
                onClick={() => setUploadMode('paste')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === 'paste'
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-white/5 text-[#8FA3BF] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Paste Text
                </div>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Version Number
                  </label>
                  <input
                    type="text"
                    value={newVersion.versionNumber}
                    onChange={(e) => setNewVersion(prev => ({ ...prev, versionNumber: e.target.value }))}
                    placeholder={`Auto: v${(playbook?.current_version || 0) + 1}`}
                    className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]"
                  />
                  <p className="text-xs text-[#64748B] mt-1">Leave blank to auto-increment, or enter custom (e.g., 5.2)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Change Notes
                  </label>
                  <input
                    type="text"
                    value={newVersion.changeNotes}
                    onChange={(e) => setNewVersion(prev => ({ ...prev, changeNotes: e.target.value }))}
                    placeholder="What changed in this version?"
                    className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>

              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Upload Agreement File <span className="text-red-400">*</span>
                  </label>

                  {/* Drag & Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
                        : selectedFile
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-white/20 hover:border-white/40 bg-[#0B1220]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-3">
                        {getFileIcon(selectedFile.name.split('.').pop() || null)}
                        <div className="text-left">
                          <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-[#8FA3BF]">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-[#8FA3BF] hover:text-white"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <svg className="w-10 h-10 text-[#64748B] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-[#8FA3BF]">
                          Drag & drop your file here, or <span className="text-[#8B5CF6]">browse</span>
                        </p>
                        <p className="text-xs text-[#64748B] mt-1">
                          Supports PDF, Word (.docx, .doc), and text files
                        </p>
                      </>
                    )}
                  </div>

                  {uploadError && (
                    <p className="mt-2 text-sm text-red-400">{uploadError}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                    Content <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={newVersion.content}
                    onChange={(e) => setNewVersion(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Full agreement text..."
                    rows={20}
                    className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6] resize-none font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewVersionModal(false);
                  setNewVersion({ content: '', changeNotes: '', versionNumber: '' });
                  setSelectedFile(null);
                  setUploadError(null);
                }}
                className="flex-1 px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={creating || (uploadMode === 'paste' && !newVersion.content.trim()) || (uploadMode === 'file' && !selectedFile)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Version'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-6 max-w-md w-full"
          >
            <h3 className="text-lg font-bold text-white mb-2">Delete Playbook?</h3>
            <p className="text-sm text-[#8FA3BF] mb-6">
              This will permanently delete &ldquo;{playbook.name}&rdquo; and all its version history. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete Playbook
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
