/**
 * Run the manual status override migration directly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔧 Running manual status override migration...\n');

  try {
    // Step 1: Add the column via raw SQL using postgres connection
    console.log('Step 1: Adding manual_status_override column...');

    // Use sql query directly
    const { data: result1, error: error1 } = await admin
      .from('contracts')
      .select('manual_status_override')
      .limit(1);

    if (error1 && error1.message.includes('column "manual_status_override" does not exist')) {
      console.log('❌ Column does not exist. Using REST API workaround...');

      // We need to use the REST API to add the column
      // Unfortunately Supabase REST API doesn't support ALTER TABLE
      // So we'll use a different approach - create a temporary admin endpoint
      const response = await fetch('http://localhost:3000/api/admin/add-status-column', {
        method: 'POST',
      });

      const result = await response.json();
      console.log(result.message);
    } else if (error1) {
      throw error1;
    } else {
      console.log('✅ Column already exists');
    }

    console.log('\n✅ Migration completed!\n');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
