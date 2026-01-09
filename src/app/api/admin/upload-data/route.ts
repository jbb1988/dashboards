import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = 'data-files';

/**
 * POST - Upload closeout-data.xlsx from local data folder to Supabase Storage
 * This is an admin endpoint for initial data setup
 */
export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const fileName = 'closeout-data.xlsx';
    const filePath = path.join(process.cwd(), 'data', fileName);

    // Check if file exists locally
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        error: 'File not found',
        message: `${fileName} not found in data folder`,
      }, { status: 404 });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

    // Check if bucket exists, create if not
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
      });
      if (createError) {
        return NextResponse.json({
          error: 'Failed to create bucket',
          message: createError.message,
        }, { status: 500 });
      }
    }

    // Upload the file (upsert to overwrite if exists)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (error) {
      return NextResponse.json({
        error: 'Upload failed',
        message: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${fileName} to Supabase Storage`,
      details: {
        bucket: BUCKET_NAME,
        path: data.path,
        size: `${fileSizeMB} MB`,
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET - Check if closeout-data.xlsx exists in Supabase Storage
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const fileName = 'closeout-data.xlsx';

    // Check bucket
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      return NextResponse.json({
        exists: false,
        message: `Bucket ${BUCKET_NAME} does not exist`,
        action: 'POST to this endpoint to upload the file',
      });
    }

    // List files in bucket
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list();

    if (error) {
      return NextResponse.json({
        error: 'Failed to list files',
        message: error.message,
      }, { status: 500 });
    }

    const fileExists = files?.some(f => f.name === fileName);

    // Check if local file exists
    const localPath = path.join(process.cwd(), 'data', fileName);
    const localExists = fs.existsSync(localPath);

    return NextResponse.json({
      bucket: BUCKET_NAME,
      fileInStorage: fileExists,
      fileInLocal: localExists,
      files: files?.map(f => ({ name: f.name, size: f.metadata?.size })),
      action: fileExists ? 'File already uploaded' : 'POST to this endpoint to upload',
    });

  } catch (error) {
    console.error('Check error:', error);
    return NextResponse.json({
      error: 'Check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
