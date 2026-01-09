/**
 * Script to upload closeout-data.xlsx to Supabase Storage
 *
 * Run with: npx ts-node scripts/upload-closeout-data.ts
 *
 * Requires environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = 'data-files';
const FILE_NAME = 'closeout-data.xlsx';

async function main() {
  // Load environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables:');
    console.error('- NEXT_PUBLIC_SUPABASE_URL');
    console.error('- SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read the file
  const filePath = path.join(process.cwd(), 'data', FILE_NAME);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(filePath);
  console.log(`Read ${FILE_NAME} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // Create bucket if it doesn't exist
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

  if (!bucketExists) {
    console.log(`Creating bucket: ${BUCKET_NAME}`);
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
    });
    if (createError) {
      console.error('Error creating bucket:', createError);
      process.exit(1);
    }
  }

  // Upload the file
  console.log(`Uploading ${FILE_NAME} to ${BUCKET_NAME}...`);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(FILE_NAME, fileBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });

  if (error) {
    console.error('Upload error:', error);
    process.exit(1);
  }

  console.log('Upload successful!');
  console.log('File path:', data.path);
  console.log('\nThe MCC and Closeout dashboards will now use this file from Supabase Storage.');
}

main().catch(console.error);
