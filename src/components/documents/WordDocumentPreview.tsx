'use client';

import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';

interface WordDocumentPreviewProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

export default function WordDocumentPreview({ fileUrl, fileName, onClose }: WordDocumentPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch the DOCX file
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }

        const blob = await response.blob();

        // Render the document with tracked changes visible
        if (containerRef.current) {
          await renderAsync(blob, containerRef.current, undefined, {
            className: 'docx-preview',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: false,
            trimXmlDeclaration: true,
            useBase64URL: false,
            useMathMLPolyfill: false,
            showChanges: true, // Show tracked changes
            debug: false,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading Word document:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setLoading(false);
      }
    };

    loadDocument();
  }, [fileUrl]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-[#2B5797]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="white" strokeWidth="1"/>
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{fileName}</h2>
              <p className="text-sm text-gray-500">Word Document Preview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin mb-4" />
              <p className="text-gray-600">Loading document...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full">
              <svg className="w-16 h-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-900 font-semibold mb-2">Failed to load document</p>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#38BDF8] text-white rounded-lg hover:bg-[#0EA5E9] transition-colors"
              >
                Close
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            className="docx-container bg-white shadow-lg rounded-lg"
            style={{
              minHeight: loading ? '400px' : 'auto',
              display: loading || error ? 'none' : 'block'
            }}
          />
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-white">
            <div className="text-sm text-gray-600">
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 bg-red-200 border border-red-400 rounded-sm"></span>
                Deletions shown with strikethrough
                <span className="ml-4 w-3 h-3 bg-green-200 border border-green-400 rounded-sm"></span>
                Additions shown with underline
              </span>
            </div>
            <button
              onClick={() => window.open(fileUrl, '_blank')}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Download Original
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
