-- Migration: Enhanced User Management with Custom Roles & Dashboard Permissions
-- This migration adds support for:
-- - Custom roles (beyond the 6 built-in roles)
-- - Database-driven dashboard access configuration
-- - Per-user dashboard overrides (grant/revoke)

-- ============================================
-- 1. Create roles table
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed with existing roles
INSERT INTO roles (name, description, is_system) VALUES
  ('admin', 'Full system access to all dashboards and admin settings', true),
  ('sales', 'Access to sales-related dashboards', true),
  ('finance', 'Access to financial dashboards and reports', true),
  ('pm', 'Access to project management dashboards', true),
  ('legal', 'Access to contract review and legal tools', true),
  ('viewer', 'Basic read-only access to guides only', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. Create dashboards table
-- ============================================
CREATE TABLE IF NOT EXISTS dashboards (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  category VARCHAR(50),
  route VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Seed with current dashboards
INSERT INTO dashboards (id, name, description, icon, category, route, sort_order) VALUES
  ('contracts-dashboard', 'Contracts Pipeline', 'Track contract status and pipeline from Salesforce', 'file-text', 'Contracts', '/contracts-dashboard', 1),
  ('contracts-review', 'Contract Review', 'AI-powered contract analysis with Claude', 'scale', 'Contracts', '/contracts/review', 2),
  ('diversified-dashboard', 'Diversified Products', 'Sales performance by product class from NetSuite', 'bar-chart', 'Sales', '/diversified-dashboard', 3),
  ('pm-dashboard', 'Project Tracker', 'Monitor milestones and tasks from Asana', 'calendar', 'Project Management', '/pm-dashboard', 4),
  ('mcc-dashboard', 'MCC Profitability', 'Annual maintenance contract profitability analysis', 'dollar-sign', 'Finance', '/mcc-dashboard', 5),
  ('closeout-dashboard', 'Project Profitability', 'Project closeout metrics from NetSuite', 'trending-up', 'Finance', '/closeout-dashboard', 6),
  ('admin', 'User Management', 'Manage users, roles, and permissions', 'users', 'Administration', '/admin', 7),
  ('guides', 'Guides & Documentation', 'User guides and help documentation', 'book-open', 'Resources', '/guides', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  route = EXCLUDED.route,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 3. Create role_dashboard_access table
-- ============================================
CREATE TABLE IF NOT EXISTS role_dashboard_access (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  dashboard_id VARCHAR(50) REFERENCES dashboards(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, dashboard_id)
);

-- Seed with current role-dashboard mappings
-- Admin gets all dashboards
INSERT INTO role_dashboard_access (role_id, dashboard_id)
SELECT r.id, d.id
FROM roles r, dashboards d
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Sales: Contracts Pipeline, Diversified Products, Guides
INSERT INTO role_dashboard_access (role_id, dashboard_id)
SELECT r.id, d.id
FROM roles r, dashboards d
WHERE r.name = 'sales' AND d.id IN ('contracts-dashboard', 'diversified-dashboard', 'guides')
ON CONFLICT DO NOTHING;

-- Finance: MCC Profitability, Project Profitability, Diversified Products, Guides
INSERT INTO role_dashboard_access (role_id, dashboard_id)
SELECT r.id, d.id
FROM roles r, dashboards d
WHERE r.name = 'finance' AND d.id IN ('mcc-dashboard', 'closeout-dashboard', 'diversified-dashboard', 'guides')
ON CONFLICT DO NOTHING;

-- PM: Project Tracker, Project Profitability, Guides
INSERT INTO role_dashboard_access (role_id, dashboard_id)
SELECT r.id, d.id
FROM roles r, dashboards d
WHERE r.name = 'pm' AND d.id IN ('pm-dashboard', 'closeout-dashboard', 'guides')
ON CONFLICT DO NOTHING;

-- Legal: Contract Review, Guides
INSERT INTO role_dashboard_access (role_id, dashboard_id)
SELECT r.id, d.id
FROM roles r, dashboards d
WHERE r.name = 'legal' AND d.id IN ('contracts-review', 'guides')
ON CONFLICT DO NOTHING;

-- Viewer: Guides only
INSERT INTO role_dashboard_access (role_id, dashboard_id)
SELECT r.id, d.id
FROM roles r, dashboards d
WHERE r.name = 'viewer' AND d.id = 'guides'
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. Create user_dashboard_overrides table
-- ============================================
CREATE TABLE IF NOT EXISTS user_dashboard_overrides (
  user_id UUID NOT NULL,
  dashboard_id VARCHAR(50) REFERENCES dashboards(id) ON DELETE CASCADE,
  access_type VARCHAR(10) NOT NULL CHECK (access_type IN ('grant', 'revoke')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id, dashboard_id)
);

-- ============================================
-- 5. Add role_id to user_roles table
-- ============================================
-- First, add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN role_id UUID REFERENCES roles(id);
  END IF;
END $$;

-- Migrate existing role strings to role_id references
UPDATE user_roles ur
SET role_id = r.id
FROM roles r
WHERE ur.role = r.name AND ur.role_id IS NULL;

-- ============================================
-- 6. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_role_dashboard_access_role ON role_dashboard_access(role_id);
CREATE INDEX IF NOT EXISTS idx_role_dashboard_access_dashboard ON role_dashboard_access(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_overrides_user ON user_dashboard_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ============================================
-- 7. Create helper view for effective user permissions
-- ============================================
CREATE OR REPLACE VIEW user_effective_dashboards AS
SELECT
  ur.user_id,
  d.id as dashboard_id,
  d.name as dashboard_name,
  d.route,
  d.category,
  d.sort_order,
  CASE
    WHEN udo.access_type = 'revoke' THEN false
    WHEN udo.access_type = 'grant' THEN true
    WHEN rda.dashboard_id IS NOT NULL THEN true
    ELSE false
  END as has_access,
  CASE
    WHEN udo.access_type IS NOT NULL THEN udo.access_type
    WHEN rda.dashboard_id IS NOT NULL THEN 'role'
    ELSE 'none'
  END as access_source
FROM user_roles ur
CROSS JOIN dashboards d
LEFT JOIN roles r ON ur.role_id = r.id OR ur.role = r.name
LEFT JOIN role_dashboard_access rda ON r.id = rda.role_id AND d.id = rda.dashboard_id
LEFT JOIN user_dashboard_overrides udo ON ur.user_id = udo.user_id AND d.id = udo.dashboard_id
WHERE d.is_active = true;

-- ============================================
-- 8. RLS Policies (if RLS is enabled)
-- ============================================
-- Allow admins to manage roles
-- Note: These policies assume you have RLS enabled.
-- Adjust based on your security requirements.

-- ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE role_dashboard_access ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_dashboard_overrides ENABLE ROW LEVEL SECURITY;

-- For now, we'll rely on application-level authorization
-- via the admin role check in the API endpoints
