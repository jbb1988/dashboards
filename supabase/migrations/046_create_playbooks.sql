-- Create playbooks table for storing MARS standard agreements
-- Playbooks allow tracking of MARS's own standard agreements with version history

CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  current_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version history for each playbook
CREATE TABLE IF NOT EXISTS playbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint on playbook_id + version
CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_versions_unique
ON playbook_versions(playbook_id, version);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_playbook_versions_playbook_id
ON playbook_versions(playbook_id);

-- Add comments for documentation
COMMENT ON TABLE playbooks IS 'MARS standard agreements and templates with version tracking';
COMMENT ON TABLE playbook_versions IS 'Version history for each playbook';
COMMENT ON COLUMN playbooks.name IS 'Name of the standard agreement (e.g., MARS NDA, MARS Warranty T&C)';
COMMENT ON COLUMN playbooks.description IS 'Description of what this playbook covers';
COMMENT ON COLUMN playbooks.current_version IS 'Current/latest version number';
COMMENT ON COLUMN playbook_versions.content IS 'Full text content of this version';
COMMENT ON COLUMN playbook_versions.change_notes IS 'Notes describing changes in this version';
COMMENT ON COLUMN playbook_versions.created_by IS 'Email of user who created this version';

-- Insert default MARS playbooks
INSERT INTO playbooks (name, description) VALUES
  ('MARS Warranty General Terms & Conditions', 'Standard warranty terms and conditions for MARS products and services'),
  ('MARS MCC Maintenance and Services Agreement', 'Standard maintenance and services agreement template'),
  ('MARS M3 EULA', 'End User License Agreement for MARS M3 software'),
  ('MARS NDA', 'Standard Non-Disclosure Agreement for MARS')
ON CONFLICT DO NOTHING;
