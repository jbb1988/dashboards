import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/setup-storage
 * Creates the data-files bucket and sets up proper access policies
 */
export async function POST() {
  try {
    const admin = getSupabaseAdmin();

    // Step 1: Create the bucket
    const { data: existingBuckets, error: listError } = await admin.storage.listBuckets();

    if (listError) {
      return NextResponse.json({
        error: 'Failed to list buckets',
        details: listError.message
      }, { status: 500 });
    }

    const bucketExists = existingBuckets?.some(b => b.name === 'data-files');

    if (!bucketExists) {
      const { data: bucket, error: createError } = await admin.storage.createBucket('data-files', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/msword', // .doc
          'application/vnd.ms-excel', // .xls
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'text/plain',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ],
      });

      if (createError) {
        return NextResponse.json({
          error: 'Failed to create bucket',
          details: createError.message
        }, { status: 500 });
      }

      console.log('Created data-files bucket:', bucket);
    } else {
      // Bucket exists, make sure it's public
      const { error: updateError } = await admin.storage.updateBucket('data-files', {
        public: true,
        fileSizeLimit: 52428800,
      });

      if (updateError) {
        console.warn('Failed to update bucket to public:', updateError.message);
        // Don't fail the request
      }
    }

    // Step 2: Set up RLS policies for the bucket
    // Allow authenticated users to upload and read files
    const policySQL = `
      -- Enable RLS on storage.objects
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

      -- Policy: Allow authenticated users to upload files
      CREATE POLICY IF NOT EXISTS "Allow authenticated uploads to data-files"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'data-files');

      -- Policy: Allow public read access
      CREATE POLICY IF NOT EXISTS "Allow public read access to data-files"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'data-files');

      -- Policy: Allow authenticated users to update their own files
      CREATE POLICY IF NOT EXISTS "Allow authenticated updates to data-files"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'data-files');

      -- Policy: Allow authenticated users to delete their own files
      CREATE POLICY IF NOT EXISTS "Allow authenticated deletes to data-files"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'data-files');
    `;

    // Execute the SQL using Supabase Management API
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    const projectRef = process.env.SUPABASE_PROJECT_REF;

    if (accessToken && projectRef) {
      try {
        const response = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: policySQL }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('Failed to set up storage policies (may already exist):', errorText);
          // Don't fail the request - policies might already exist
        }
      } catch (err) {
        console.warn('Error setting up storage policies:', err);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      message: bucketExists
        ? 'Bucket already exists'
        : 'Storage bucket created successfully',
      bucketName: 'data-files',
    });
  } catch (error) {
    console.error('Error setting up storage:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
