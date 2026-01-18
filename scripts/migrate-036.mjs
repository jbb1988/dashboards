import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read env
const envFile = readFileSync('.env.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Supabase credentials not found');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

try {
  console.log('Running migration 036...');

  // Add columns
  const { error: error1 } = await supabase.from('netsuite_sales_order_lines').select('item_class_id').limit(0);

  if (error1?.message?.includes('does not exist')) {
    console.log('Adding item_class columns...');
    // Use raw SQL via RPC if available, otherwise manual via SQL editor needed
    console.log('\n⚠️  Please run the following SQL in Supabase SQL Editor:');
    console.log(`
ALTER TABLE netsuite_sales_order_lines
  ADD COLUMN IF NOT EXISTS item_class_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_class_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ns_sol_item_class
  ON netsuite_sales_order_lines(item_class_name);

COMMENT ON COLUMN netsuite_sales_order_lines.item_class_id
  IS 'Item class ID from NetSuite (e.g., 1=Test Bench, 28=Other)';

COMMENT ON COLUMN netsuite_sales_order_lines.item_class_name
  IS 'Item class name used for product type classification';
    `);
    process.exit(0);
  }

  console.log('✅ Columns already exist - migration complete');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
