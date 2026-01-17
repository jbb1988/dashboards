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

// Count total SO lines
const { count: totalLines } = await supabase
  .from('netsuite_sales_order_lines')
  .select('*', { count: 'exact', head: true });

console.log('Total SO lines in database:', totalLines);

// Get a sample of lines with their SO IDs
const { data: sampleLines } = await supabase
  .from('netsuite_sales_order_lines')
  .select('id, sales_order_id, netsuite_line_id, item_id, quantity, rate, amount')
  .limit(5);

console.log('\nSample line items:');
sampleLines?.forEach(line => {
  console.log(`  SO ID: ${line.sales_order_id}, Item: ${line.item_id}, Amount: ${line.amount}`);
});

// Check if any lines are linked to valid SOs
if (sampleLines?.length > 0) {
  const soId = sampleLines[0].sales_order_id;
  const { data: so } = await supabase
    .from('netsuite_sales_orders')
    .select('so_number, customer_name')
    .eq('id', soId)
    .single();
  
  console.log('\nSample linked SO:', so);
}

// Find SOs that DO have line items
const { data: sosWithLines } = await supabase
  .from('netsuite_sales_order_lines')
  .select('sales_order_id')
  .limit(100);

const uniqueSoIds = [...new Set(sosWithLines?.map(l => l.sales_order_id))];
console.log('\nNumber of SOs with at least one line item:', uniqueSoIds.length);

// Get details of one SO with lines
if (uniqueSoIds.length > 0) {
  const { data: soWithLines } = await supabase
    .from('netsuite_sales_orders')
    .select('so_number, customer_name, netsuite_sales_order_lines(id, amount)')
    .eq('id', uniqueSoIds[0])
    .single();
  
  console.log('\nExample SO with lines:', soWithLines?.so_number, soWithLines?.customer_name);
  console.log('  Line count:', soWithLines?.netsuite_sales_order_lines?.length);
}
