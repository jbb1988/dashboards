import { netsuiteRequest } from '../src/lib/netsuite.js';

async function searchWO5346() {
  const query = `SELECT id, tranid, type, status, trandate, entity, createdfrom FROM Transaction WHERE tranid = 'WO5346'`;

  try {
    const response = await netsuiteRequest(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: query },
        params: { limit: '10' },
      }
    );

    console.log('Search for WO5346:');
    console.log(JSON.stringify(response, null, 2));

    if (response.items && response.items.length > 0) {
      console.log('\n✓ WO5346 EXISTS in NetSuite!');
      console.log('  NetSuite ID:', response.items[0].id);
      console.log('  Created from:', response.items[0].createdfrom);
    } else {
      console.log('\n✗ WO5346 does NOT exist in NetSuite');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

searchWO5346();
