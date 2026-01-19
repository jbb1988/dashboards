'use client';

interface WordDocumentViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

export default function WordDocumentViewer({ fileUrl, fileName, onClose }: WordDocumentViewerProps) {
  // Use Microsoft Office Online viewer which properly displays tracked changes
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-[#2B5797]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="white" strokeWidth="1"/>
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{fileName}</h2>
              <p className="text-sm text-gray-500">Word Document with Tracked Changes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              download={fileName}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
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
        </div>

        {/* Microsoft Office Viewer Iframe */}
        <div className="flex-1 relative bg-gray-100 rounded-b-lg overflow-hidden">
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            title={fileName}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tracked changes (redlines) are visible in the preview above. For full editing capabilities, download and open in Microsoft Word.
          </div>
        </div>
      </div>
    </div>
  );
}
