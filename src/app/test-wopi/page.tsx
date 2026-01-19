'use client';

import { useState } from 'react';

export default function TestWOPIPage() {
  const [documentId, setDocumentId] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testWOPI = async () => {
    if (!documentId) {
      setError('Please enter a document ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Step 1: Generate token
      console.log('Step 1: Generating token...');
      const tokenResponse = await fetch('/api/wopi/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token generation failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token generated:', tokenData);

      // Step 2: Test CheckFileInfo
      console.log('Step 2: Testing CheckFileInfo...');
      const checkUrl = `/api/wopi/files/${tokenData.file_id}?access_token=${tokenData.access_token}`;
      const checkResponse = await fetch(checkUrl);

      if (!checkResponse.ok) {
        throw new Error(`CheckFileInfo failed: ${checkResponse.status} ${checkResponse.statusText}`);
      }

      const checkData = await checkResponse.json();
      console.log('CheckFileInfo response:', checkData);

      // Step 3: Test GetFile
      console.log('Step 3: Testing GetFile...');
      const getFileUrl = `/api/wopi/files/${tokenData.file_id}/contents?access_token=${tokenData.access_token}`;
      const getFileResponse = await fetch(getFileUrl);

      if (!getFileResponse.ok) {
        throw new Error(`GetFile failed: ${getFileResponse.status} ${getFileResponse.statusText}`);
      }

      const fileSize = getFileResponse.headers.get('content-length');
      console.log('GetFile succeeded, file size:', fileSize);

      // Construct Word Online URL
      const wopiSrc = `${window.location.origin}/api/wopi/files/${tokenData.file_id}`;
      const wordOnlineUrl = `https://word-view.officeapps.live.com/wv/wordviewerframe.aspx?WOPISrc=${encodeURIComponent(wopiSrc)}&access_token=${tokenData.access_token}`;

      setResults({
        token: tokenData,
        checkFileInfo: checkData,
        fileSize,
        wordOnlineUrl,
        wopiSrc,
      });

    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">WOPI Integration Test</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2">
            Document ID
          </label>
          <input
            type="text"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            placeholder="Enter document ID from your database"
            className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 mb-4"
          />

          <button
            onClick={testWOPI}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium"
          >
            {loading ? 'Testing...' : 'Test WOPI Endpoints'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold mb-2">❌ Error</h2>
            <pre className="text-sm overflow-x-auto">{error}</pre>
          </div>
        )}

        {results && (
          <div className="space-y-6">
            <div className="bg-green-900/50 border border-green-500 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-2">✅ All Tests Passed!</h2>
              <p className="text-sm">Your WOPI endpoints are working correctly.</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-2">Token Data</h3>
              <pre className="text-xs bg-gray-900 p-3 rounded overflow-x-auto">
                {JSON.stringify(results.token, null, 2)}
              </pre>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-2">CheckFileInfo Response</h3>
              <pre className="text-xs bg-gray-900 p-3 rounded overflow-x-auto">
                {JSON.stringify(results.checkFileInfo, null, 2)}
              </pre>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-2">GetFile Status</h3>
              <p className="text-sm">File size: {results.fileSize} bytes</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-2">WOPI Source URL</h3>
              <code className="text-xs bg-gray-900 p-3 rounded block overflow-x-auto">
                {results.wopiSrc}
              </code>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-2">Word Online URL</h3>
              <code className="text-xs bg-gray-900 p-3 rounded block overflow-x-auto mb-4">
                {results.wordOnlineUrl}
              </code>
              <button
                onClick={() => window.open(results.wordOnlineUrl, '_blank')}
                className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-medium"
              >
                Open in Word Online
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
