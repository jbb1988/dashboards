-- Add file storage columns to playbook_versions
ALTER TABLE playbook_versions ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE playbook_versions ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE playbook_versions ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE playbook_versions ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Create storage bucket for playbook files if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('playbook-files', 'playbook-files', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Allow authenticated uploads to playbook-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads from playbook-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role full access to playbook-files" ON storage.objects;

-- Allow authenticated access to playbook files
CREATE POLICY "Allow authenticated uploads to playbook-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'playbook-files');

CREATE POLICY "Allow authenticated downloads from playbook-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'playbook-files');

-- Also allow service role (for API routes)
CREATE POLICY "Allow service role full access to playbook-files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'playbook-files');
