-- Migration 021: Create distributor_tasks and distributor_insights tables
-- Supports AI-powered insights, task generation, and task management for distributor dashboard

-- Table for AI-generated insights about distributors and locations
CREATE TABLE IF NOT EXISTS distributor_insights (
  id SERIAL PRIMARY KEY,
  distributor_name VARCHAR(100),
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),
  priority VARCHAR(20) CHECK (priority IN ('high', 'medium', 'low')),
  category VARCHAR(50) CHECK (category IN ('attrisk', 'growth', 'categorygap', 'expansion')),
  title VARCHAR(500),
  problem TEXT,
  recommendation TEXT,
  expected_impact TEXT,
  action_items JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for distributor_insights
CREATE INDEX idx_dist_insights_distributor ON distributor_insights(distributor_name);
CREATE INDEX idx_dist_insights_priority ON distributor_insights(priority);
CREATE INDEX idx_dist_insights_category ON distributor_insights(category);
CREATE INDEX idx_dist_insights_customer ON distributor_insights(customer_id);

-- Table for sales tasks related to distributors
CREATE TABLE IF NOT EXISTS distributor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  distributor_name VARCHAR(100),
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),
  location VARCHAR(100),
  priority VARCHAR(20) CHECK (priority IN ('urgent', 'high', 'medium', 'low')) DEFAULT 'medium',
  status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  due_date DATE,
  assignee_email VARCHAR(255),
  assignee_name VARCHAR(255),
  source VARCHAR(50) CHECK (source IN ('manual', 'ai_insight', 'auto_churn')) DEFAULT 'manual',
  insight_id INTEGER REFERENCES distributor_insights(id) ON DELETE SET NULL,
  asana_gid VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for distributor_tasks
CREATE INDEX idx_dist_tasks_distributor ON distributor_tasks(distributor_name);
CREATE INDEX idx_dist_tasks_status ON distributor_tasks(status);
CREATE INDEX idx_dist_tasks_priority ON distributor_tasks(priority);
CREATE INDEX idx_dist_tasks_customer ON distributor_tasks(customer_id);
CREATE INDEX idx_dist_tasks_due_date ON distributor_tasks(due_date) WHERE status != 'completed';
CREATE INDEX idx_dist_tasks_assignee ON distributor_tasks(assignee_email);
CREATE INDEX idx_dist_tasks_source ON distributor_tasks(source);

-- Add comments
COMMENT ON TABLE distributor_insights IS 'AI-generated insights for distributor growth opportunities, at-risk locations, and category gaps';
COMMENT ON TABLE distributor_tasks IS 'Sales tasks for distributor management with Asana integration support';
