import * as dotenv from 'dotenv';

// Load env vars first
dotenv.config({ path: '.env.local' });

console.log('After dotenv.config():');
console.log('  NETSUITE_ACCOUNT_ID:', process.env.NETSUITE_ACCOUNT_ID?.substring(0, 4) + '...');

async function main() {
  // Dynamic import after env vars are loaded
  const { netsuiteRequest } = await import('../src/lib/netsuite');

  console.log('\nTrying NetSuite request...');

  try {
    const result = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: "SELECT id, tranid FROM transaction WHERE type = 'SalesOrd' AND tranid = 'SO5571'" },
        params: { limit: '1' },
      }
    );
    console.log('Success! Result:', result);
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

main();
