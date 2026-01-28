-- Migration: Create Asana tasks cache table for global search
-- Purpose: Store cached Asana tasks for fast searchability without API rate limits

-- ============================================================================
-- STEP 1: Create asana_tasks_cache table
-- ============================================================================

CREATE TABLE asana_tasks_cache (
  -- Primary Key (using Asana GID)
  asana_gid VARCHAR(100) PRIMARY KEY,

  -- Task Information
  name TEXT NOT NULL,
  notes TEXT,

  -- Project/Section Context
  project_gid VARCHAR(100),
  project_name TEXT,
  section_gid VARCHAR(100),
  section_name TEXT,

  -- Assignment
  assignee_gid VARCHAR(100),
  assignee_name TEXT,
  assignee_email TEXT,

  -- Dates
  due_on DATE,
  start_on DATE,
  completed_at TIMESTAMPTZ,
  created_at_asana TIMESTAMPTZ,
  modified_at_asana TIMESTAMPTZ,

  -- Status
  completed BOOLEAN DEFAULT false,

  -- Custom Fields (stored as JSONB for flexibility)
  custom_fields JSONB,

  -- Tags (stored as JSONB array)
  tags JSONB,

  -- Sync Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Add indexes for searching and filtering
-- ============================================================================

-- Full-text search index
CREATE INDEX idx_asana_tasks_search ON asana_tasks_cache
USING gin(to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(notes, '') || ' ' ||
  coalesce(project_name, '') || ' ' ||
  coalesce(assignee_name, '')
));

-- Trigram index for fuzzy matching on task name
CREATE INDEX idx_asana_tasks_name_trgm ON asana_tasks_cache
USING gin(name gin_trgm_ops);

-- Index for filtering by project
CREATE INDEX idx_asana_tasks_project ON asana_tasks_cache(project_gid);

-- Index for filtering by completion status
CREATE INDEX idx_asana_tasks_completed ON asana_tasks_cache(completed);

-- Index for filtering by due date
CREATE INDEX idx_asana_tasks_due ON asana_tasks_cache(due_on);

-- Index for filtering by assignee
CREATE INDEX idx_asana_tasks_assignee ON asana_tasks_cache(assignee_gid);

-- Index for sync tracking
CREATE INDEX idx_asana_tasks_synced ON asana_tasks_cache(synced_at);

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE asana_tasks_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all cached tasks
CREATE POLICY "Allow authenticated users to read asana_tasks_cache"
  ON asana_tasks_cache FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access for sync operations
CREATE POLICY "Allow service role full access to asana_tasks_cache"
  ON asana_tasks_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 4: Add trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_asana_tasks_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_asana_tasks_cache_updated_at
  BEFORE UPDATE ON asana_tasks_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_asana_tasks_cache_updated_at();

-- ============================================================================
-- STEP 5: Add sync tracking table for incremental syncs
-- ============================================================================

CREATE TABLE asana_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_gid VARCHAR(100) NOT NULL UNIQUE,
  project_name TEXT,
  last_sync_at TIMESTAMPTZ,
  last_modified_at TIMESTAMPTZ,  -- Track the most recent task modification
  task_count INTEGER DEFAULT 0,
  sync_status VARCHAR(50) DEFAULT 'pending',  -- pending, syncing, completed, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS for sync status table
ALTER TABLE asana_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read asana_sync_status"
  ON asana_sync_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to asana_sync_status"
  ON asana_sync_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE asana_tasks_cache IS 'Cached Asana tasks for fast global search - synced periodically from Asana API';
COMMENT ON TABLE asana_sync_status IS 'Tracks sync status per Asana project for incremental syncing';
COMMENT ON COLUMN asana_tasks_cache.custom_fields IS 'Asana custom fields stored as JSONB for flexibility';
COMMENT ON COLUMN asana_tasks_cache.tags IS 'Asana tags stored as JSONB array';
COMMENT ON COLUMN asana_sync_status.last_modified_at IS 'Most recent task modification timestamp for incremental sync';

-- ============================================================================
-- Migration complete!
-- ============================================================================

-- Next steps:
-- 1. Configure ASANA_ACCESS_TOKEN and ASANA_WORKSPACE_ID env vars
-- 2. Run initial sync: POST /api/asana/sync-tasks
-- 3. Set up scheduled sync (e.g., every 15 minutes) via cron
