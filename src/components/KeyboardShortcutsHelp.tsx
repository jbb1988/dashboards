'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette / search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / blur input' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['J'], description: 'Move down in list' },
      { keys: ['K'], description: 'Move up in list' },
      { keys: ['Enter'], description: 'Select / expand item' },
      { keys: ['G', 'P'], description: 'Go to Pipeline' },
      { keys: ['G', 'T'], description: 'Go to Tasks' },
      { keys: ['G', 'D'], description: 'Go to Documents' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['T'], description: 'Create new task' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['F'], description: 'Toggle filters' },
      { keys: ['R'], description: 'Refresh data' },
      { keys: ['O'], description: 'Open in Salesforce' },
    ],
  },
  {
    title: 'Command Palette',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate items' },
      { keys: ['Enter'], description: 'Execute command' },
      { keys: ['Tab'], description: 'Switch search scope' },
    ],
  },
];

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="absolute top-[10%] left-1/2 -translate-x-1/2 w-full max-w-3xl"
        >
          <div className="mx-4 bg-[#1A2332] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#38BDF8]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
                  <p className="text-sm text-[#64748B]">Navigate faster with keyboard commands</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-[#64748B] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 grid grid-cols-2 gap-6 max-h-[600px] overflow-y-auto">
              {shortcutGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-3">
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="text-sm text-[#A1B4C9]">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <div key={keyIndex} className="flex items-center gap-1">
                              <kbd className="px-2 py-1 min-w-[28px] text-center bg-[#0B1220] border border-white/[0.1] rounded text-xs text-white font-mono">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-[#64748B] text-xs">then</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/[0.06] bg-[#0B1220]/50">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span>Press <kbd className="px-1.5 py-0.5 bg-white/[0.05] rounded">?</kbd> anytime to see shortcuts</span>
                <span>Press <kbd className="px-1.5 py-0.5 bg-white/[0.05] rounded">ESC</kbd> to close</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
