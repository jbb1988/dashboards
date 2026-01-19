/**
 * WOPI Endpoint Test Script
 *
 * Run this to test if your WOPI endpoints are accessible:
 * node test-wopi.js <your-base-url> <document-id>
 *
 * Example:
 * node test-wopi.js https://your-app.vercel.app 123e4567-e89b-12d3-a456-426614174000
 */

const https = require('https');
const http = require('http');

const baseUrl = process.argv[2] || 'http://localhost:3000';
const documentId = process.argv[3];

if (!documentId) {
  console.error('Usage: node test-wopi.js <base-url> <document-id>');
  console.error('Example: node test-wopi.js https://your-app.vercel.app 123e4567-e89b-12d3-a456-426614174000');
  process.exit(1);
}

console.log('🔍 Testing WOPI Integration...');
console.log('Base URL:', baseUrl);
console.log('Document ID:', documentId);
console.log('');

// Test 1: Generate Token
console.log('1️⃣ Testing token generation...');
const tokenUrl = `${baseUrl}/api/wopi/generate-token`;

const tokenData = JSON.stringify({ document_id: documentId });
const tokenUrlObj = new URL(tokenUrl);
const client = tokenUrlObj.protocol === 'https:' ? https : http;

const tokenRequest = client.request(
  tokenUrl,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': tokenData.length,
    },
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Token generation succeeded!');
        const response = JSON.parse(data);
        console.log('   Access Token:', response.access_token.substring(0, 30) + '...');
        console.log('   File ID:', response.file_id);
        console.log('   Expires In:', response.expires_in, 'seconds');
        console.log('');

        // Test 2: CheckFileInfo
        testCheckFileInfo(response.file_id, response.access_token);
      } else {
        console.error('❌ Token generation failed!');
        console.error('   Status:', res.statusCode);
        console.error('   Response:', data);
        process.exit(1);
      }
    });
  }
);

tokenRequest.on('error', (error) => {
  console.error('❌ Token generation request failed!');
  console.error('   Error:', error.message);
  process.exit(1);
});

tokenRequest.write(tokenData);
tokenRequest.end();

function testCheckFileInfo(fileId, accessToken) {
  console.log('2️⃣ Testing CheckFileInfo endpoint...');
  const checkUrl = `${baseUrl}/api/wopi/files/${fileId}?access_token=${accessToken}`;

  const checkClient = checkUrl.startsWith('https') ? https : http;

  checkClient.get(checkUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ CheckFileInfo succeeded!');
        const response = JSON.parse(data);
        console.log('   File Name:', response.BaseFileName);
        console.log('   File Size:', response.Size, 'bytes');
        console.log('   Supports Reviewing:', response.SupportsReviewing);
        console.log('');

        // Test 3: GetFile
        testGetFile(fileId, accessToken);
      } else {
        console.error('❌ CheckFileInfo failed!');
        console.error('   Status:', res.statusCode);
        console.error('   Response:', data);
        process.exit(1);
      }
    });
  }).on('error', (error) => {
    console.error('❌ CheckFileInfo request failed!');
    console.error('   Error:', error.message);
    console.error('');
    console.error('⚠️  This usually means Word Online cannot reach your WOPI endpoints.');
    console.error('   Solutions:');
    console.error('   1. Deploy to production (Vercel) with HTTPS');
    console.error('   2. Use ngrok for local testing: ngrok http 3000');
    process.exit(1);
  });
}

function testGetFile(fileId, accessToken) {
  console.log('3️⃣ Testing GetFile endpoint...');
  const getFileUrl = `${baseUrl}/api/wopi/files/${fileId}/contents?access_token=${accessToken}`;

  const getFileClient = getFileUrl.startsWith('https') ? https : http;

  getFileClient.get(getFileUrl, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ GetFile succeeded!');
      console.log('   Content-Type:', res.headers['content-type']);
      console.log('   Content-Length:', res.headers['content-length'], 'bytes');
      console.log('');
      console.log('🎉 All WOPI endpoints are working correctly!');
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Make sure you are testing on HTTPS (production or ngrok)');
      console.log('   2. Click "View" on a Word document in your app');
      console.log('   3. Word Online should open with tracked changes visible');
    } else {
      console.error('❌ GetFile failed!');
      console.error('   Status:', res.statusCode);
      process.exit(1);
    }
  }).on('error', (error) => {
    console.error('❌ GetFile request failed!');
    console.error('   Error:', error.message);
    process.exit(1);
  });
}
