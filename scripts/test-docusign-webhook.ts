/**
 * Test script for DocuSign webhook
 * Run with: npx ts-node scripts/test-docusign-webhook.ts
 *
 * Or test via curl against your deployed endpoint
 */

const TEST_PAYLOAD = {
  event: 'envelope-completed',
  apiVersion: 'v2.1',
  uri: '/restapi/v2.1/accounts/xxx/envelopes/test-envelope-123',
  retryCount: 0,
  configurationId: 12345,
  generatedDateTime: new Date().toISOString(),
  data: {
    accountId: 'test-account-id',
    userId: 'test-user-id',
    envelopeId: 'test-envelope-' + Date.now(),
    envelopeSummary: {
      status: 'completed',
      emailSubject: 'Please DocuSign: Test Customer MARS Project Final Acceptance',
      sender: {
        userName: 'Test Sender',
        email: 'sender@test.com',
      },
      recipients: {
        signers: [{
          name: 'Test Signer',
          email: 'signer@test.com',
          status: 'completed',
          signedDateTime: new Date().toISOString(),
        }],
      },
      completedDateTime: new Date().toISOString(),
      sentDateTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    },
  },
};

async function testWebhook(baseUrl: string) {
  console.log('Testing DocuSign webhook at:', `${baseUrl}/api/docusign/webhook`);
  console.log('Payload:', JSON.stringify(TEST_PAYLOAD, null, 2));
  console.log('\n--- Sending request ---\n');

  try {
    const response = await fetch(`${baseUrl}/api/docusign/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_PAYLOAD),
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (result.documentAttached) {
      console.log('\n✅ SUCCESS: Document was attached to Slack!');
    } else {
      console.log('\n⚠️  Document was NOT attached. Check the logs for details.');
      if (result.error) {
        console.log('Error:', result.error);
      }
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// Get base URL from command line or use localhost
const baseUrl = process.argv[2] || 'http://localhost:3000';
testWebhook(baseUrl);
