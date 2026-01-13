const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres.opgunonejficgxztqegf:Testbench3925!!!@db.opgunonejficgxztqegf.supabase.co:5432/postgres'
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const sql = fs.readFileSync('supabase/migrations/004_fix_document_duplication.sql', 'utf8');

    console.log('Running migration: 004_fix_document_duplication.sql');

    // Execute the SQL
    await client.query(sql);

    console.log('✅ Migration completed successfully');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await client.end();
    process.exit(1);
  }
}

runMigration();
