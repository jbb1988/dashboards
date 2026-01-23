-- Migration: 051_clause_library.sql
-- Description: Creates clause library tables for storing and managing reusable contract clauses

-- Clause categories for organizing clauses hierarchically
CREATE TABLE IF NOT EXISTS clause_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES clause_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_clause_categories_parent ON clause_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_clause_categories_sort ON clause_categories(sort_order);

-- Main clause library table
CREATE TABLE IF NOT EXISTS clause_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES clause_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Three-tier position system: favorable, neutral, fallback
  primary_text TEXT NOT NULL,           -- Favorable/preferred position
  fallback_text TEXT,                    -- Middle ground position
  last_resort_text TEXT,                 -- Minimum acceptable position
  position_type TEXT CHECK (position_type IN ('favorable', 'neutral', 'fallback')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  -- Track source for imported clauses
  source_contract_id UUID,
  source_contract_name TEXT,
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clause_library_category ON clause_library(category_id);
CREATE INDEX IF NOT EXISTS idx_clause_library_risk ON clause_library(risk_level);
CREATE INDEX IF NOT EXISTS idx_clause_library_tags ON clause_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_clause_library_active ON clause_library(is_active) WHERE is_active = true;

-- Full-text search index on clause content
CREATE INDEX IF NOT EXISTS idx_clause_library_search ON clause_library
  USING GIN(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(primary_text, '')));

-- Track clause usage in contracts
CREATE TABLE IF NOT EXISTS clause_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_id UUID REFERENCES clause_library(id) ON DELETE CASCADE,
  contract_id UUID,
  contract_name TEXT,
  -- Which position was used
  used_position TEXT CHECK (used_position IN ('primary', 'fallback', 'last_resort', 'custom')),
  -- Was the clause accepted as-is or modified?
  accepted BOOLEAN DEFAULT false,
  modified_text TEXT,                    -- If custom modifications were made
  -- Metadata
  used_by TEXT,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage analytics
CREATE INDEX IF NOT EXISTS idx_clause_usage_clause ON clause_usage_history(clause_id);
CREATE INDEX IF NOT EXISTS idx_clause_usage_contract ON clause_usage_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_clause_usage_date ON clause_usage_history(used_at);

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_clause_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE clause_library
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = NEW.clause_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment usage count
DROP TRIGGER IF EXISTS trigger_increment_clause_usage ON clause_usage_history;
CREATE TRIGGER trigger_increment_clause_usage
  AFTER INSERT ON clause_usage_history
  FOR EACH ROW
  EXECUTE FUNCTION increment_clause_usage();

-- Function to update timestamp on clause update
CREATE OR REPLACE FUNCTION update_clause_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for clause_library
DROP TRIGGER IF EXISTS trigger_update_clause_timestamp ON clause_library;
CREATE TRIGGER trigger_update_clause_timestamp
  BEFORE UPDATE ON clause_library
  FOR EACH ROW
  EXECUTE FUNCTION update_clause_timestamp();

-- Trigger for clause_categories
DROP TRIGGER IF EXISTS trigger_update_category_timestamp ON clause_categories;
CREATE TRIGGER trigger_update_category_timestamp
  BEFORE UPDATE ON clause_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_clause_timestamp();

-- Seed default categories
INSERT INTO clause_categories (name, description, sort_order) VALUES
  ('Limitation of Liability', 'Clauses limiting financial exposure and damages', 1),
  ('Indemnification', 'Mutual and one-way indemnification provisions', 2),
  ('Intellectual Property', 'IP ownership, licensing, and work product clauses', 3),
  ('Confidentiality', 'NDA and confidentiality provisions', 4),
  ('Termination', 'Contract termination and exit provisions', 5),
  ('Warranties', 'Product and service warranty clauses', 6),
  ('Payment Terms', 'Payment schedules, invoicing, and late fees', 7),
  ('Insurance', 'Insurance requirements and certificates', 8),
  ('Compliance', 'Regulatory and legal compliance provisions', 9),
  ('Dispute Resolution', 'Arbitration, mediation, and litigation clauses', 10),
  ('Force Majeure', 'Acts of God and unforeseeable events', 11),
  ('Assignment', 'Contract assignment and transfer provisions', 12),
  ('Notices', 'Communication and notice requirements', 13),
  ('Governing Law', 'Choice of law and jurisdiction', 14),
  ('General Provisions', 'Miscellaneous standard clauses', 15)
ON CONFLICT DO NOTHING;
