import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

// First get the SO record for SO7950
const { data: so, error: soErr } = await supabase
  .from('netsuite_sales_orders')
  .select('id, so_number, customer_name')
  .eq('so_number', 'SO7950')
  .single();

if (soErr) {
  console.error('Error finding SO:', soErr);
  process.exit(1);
}

console.log('Found SO:', so);

// Now check for line items linked to this SO
const { data: lines, error: lineErr } = await supabase
  .from('netsuite_sales_order_lines')
  .select('*')
  .eq('sales_order_id', so.id)
  .limit(5);

if (lineErr) {
  console.error('Error finding lines:', lineErr);
} else {
  console.log('Found', lines?.length || 0, 'line items');
  if (lines && lines.length > 0) {
    console.log('First line:', JSON.stringify(lines[0], null, 2));
  }
}

// Also try the join query
const { data: soWithLines, error: joinErr } = await supabase
  .from('netsuite_sales_orders')
  .select('so_number, netsuite_sales_order_lines(*)')
  .eq('so_number', 'SO7950')
  .single();

if (joinErr) {
  console.error('Join query error:', joinErr);
} else {
  console.log('\nJoin query result:');
  console.log('  SO:', soWithLines?.so_number);
  console.log('  Lines:', soWithLines?.netsuite_sales_order_lines?.length || 0);
}
