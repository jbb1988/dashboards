-- Migration: 052_contract_templates.sql
-- Description: Creates contract templates for self-service contract generation

-- Contract templates define structure for generating new contracts
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                -- 'nda', 'msa', 'sow', 'amendment', 'lease', etc.
  -- Template document storage
  base_document_url TEXT,                -- URL to base document in storage
  base_document_content TEXT,            -- Extracted text content for AI processing
  -- Dynamic form fields configuration (JSON Schema format)
  fields JSONB NOT NULL DEFAULT '[]',
  -- Example fields structure:
  -- [
  --   { "name": "counterparty_name", "type": "text", "label": "Counterparty Name", "required": true },
  --   { "name": "effective_date", "type": "date", "label": "Effective Date", "required": true },
  --   { "name": "term_months", "type": "number", "label": "Term (Months)", "required": true, "default": 12 },
  --   { "name": "auto_renew", "type": "boolean", "label": "Auto-Renewal", "default": false },
  --   { "name": "jurisdiction", "type": "select", "label": "Governing Law", "options": ["California", "New York", "Delaware"] }
  -- ]

  -- Approval routing rules
  approval_rules JSONB DEFAULT '{}',
  -- Example approval rules:
  -- {
  --   "default_approver": "legal@mars.com",
  --   "risk_thresholds": {
  --     "high": ["cfo@mars.com", "legal@mars.com"],
  --     "medium": ["legal@mars.com"],
  --     "low": []
  --   },
  --   "value_thresholds": [
  --     { "above": 100000, "approvers": ["cfo@mars.com", "legal@mars.com"] },
  --     { "above": 50000, "approvers": ["legal@mars.com"] }
  --   ]
  -- }

  -- Risk assessment configuration
  risk_threshold DECIMAL DEFAULT 50,     -- Auto-approve if risk score below this
  default_risk_level TEXT CHECK (default_risk_level IN ('low', 'medium', 'high')) DEFAULT 'medium',

  -- Associated playbook for clause insertion
  playbook_id UUID,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_draft BOOLEAN DEFAULT false,

  -- Metadata
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contract_templates_category ON contract_templates(category);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON contract_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_contract_templates_playbook ON contract_templates(playbook_id);

-- Track generated contracts from templates
CREATE TABLE IF NOT EXISTS template_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  -- Form input values used for generation
  field_values JSONB NOT NULL,
  -- Generated document
  generated_content TEXT NOT NULL,
  generated_document_url TEXT,
  -- Risk assessment
  risk_score DECIMAL,
  risk_factors JSONB,
  -- Approval workflow
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')) DEFAULT 'pending',
  approval_token UUID UNIQUE DEFAULT gen_random_uuid(),
  approver_email TEXT,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  -- Linked contract review (if submitted for full review)
  contract_review_id UUID,
  -- Metadata
  generated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for template generations
CREATE INDEX IF NOT EXISTS idx_template_generations_template ON template_generations(template_id);
CREATE INDEX IF NOT EXISTS idx_template_generations_status ON template_generations(approval_status);
CREATE INDEX IF NOT EXISTS idx_template_generations_token ON template_generations(approval_token);
CREATE INDEX IF NOT EXISTS idx_template_generations_date ON template_generations(created_at);

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contract_templates
  SET usage_count = usage_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment usage
DROP TRIGGER IF EXISTS trigger_increment_template_usage ON template_generations;
CREATE TRIGGER trigger_increment_template_usage
  AFTER INSERT ON template_generations
  FOR EACH ROW
  EXECUTE FUNCTION increment_template_usage();

-- Function to update template timestamp
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for contract_templates
DROP TRIGGER IF EXISTS trigger_update_template_timestamp ON contract_templates;
CREATE TRIGGER trigger_update_template_timestamp
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_template_timestamp();

-- Seed default templates
INSERT INTO contract_templates (name, description, category, fields, approval_rules, risk_threshold, created_by) VALUES
  (
    'Mutual Non-Disclosure Agreement',
    'Standard mutual NDA for protecting confidential information during business discussions',
    'nda',
    '[
      {"name": "counterparty_name", "type": "text", "label": "Counterparty Name", "required": true, "placeholder": "Company Name"},
      {"name": "counterparty_address", "type": "textarea", "label": "Counterparty Address", "required": true},
      {"name": "counterparty_signer", "type": "text", "label": "Counterparty Signer Name", "required": true},
      {"name": "counterparty_title", "type": "text", "label": "Counterparty Signer Title", "required": true},
      {"name": "effective_date", "type": "date", "label": "Effective Date", "required": true},
      {"name": "term_years", "type": "number", "label": "Term (Years)", "required": true, "default": 2, "min": 1, "max": 5},
      {"name": "confidentiality_period", "type": "number", "label": "Confidentiality Period (Years)", "required": true, "default": 3},
      {"name": "purpose", "type": "textarea", "label": "Purpose of Disclosure", "required": true, "placeholder": "Evaluating a potential business relationship..."},
      {"name": "jurisdiction", "type": "select", "label": "Governing Law", "required": true, "options": ["Virginia", "California", "New York", "Delaware"], "default": "Virginia"}
    ]'::jsonb,
    '{"default_approver": null, "auto_approve_below_risk": 30}'::jsonb,
    30,
    'system'
  ),
  (
    'Master Services Agreement',
    'Standard MSA for professional services engagements',
    'msa',
    '[
      {"name": "counterparty_name", "type": "text", "label": "Counterparty Name", "required": true},
      {"name": "counterparty_address", "type": "textarea", "label": "Counterparty Address", "required": true},
      {"name": "counterparty_signer", "type": "text", "label": "Counterparty Signer Name", "required": true},
      {"name": "counterparty_title", "type": "text", "label": "Counterparty Signer Title", "required": true},
      {"name": "effective_date", "type": "date", "label": "Effective Date", "required": true},
      {"name": "initial_term", "type": "number", "label": "Initial Term (Months)", "required": true, "default": 12},
      {"name": "auto_renew", "type": "boolean", "label": "Auto-Renewal", "default": true},
      {"name": "renewal_term", "type": "number", "label": "Renewal Term (Months)", "default": 12},
      {"name": "payment_terms", "type": "select", "label": "Payment Terms", "required": true, "options": ["Net 30", "Net 45", "Net 60"], "default": "Net 30"},
      {"name": "liability_cap", "type": "select", "label": "Liability Cap", "required": true, "options": ["Contract Value", "12 Months Fees", "$1,000,000", "$5,000,000"], "default": "Contract Value"},
      {"name": "jurisdiction", "type": "select", "label": "Governing Law", "required": true, "options": ["Virginia", "California", "New York", "Delaware"], "default": "Virginia"}
    ]'::jsonb,
    '{"default_approver": "legal@mars.com", "risk_thresholds": {"high": ["legal@mars.com", "cfo@mars.com"]}}'::jsonb,
    50,
    'system'
  ),
  (
    'Statement of Work',
    'SOW for specific project engagement under an existing MSA',
    'sow',
    '[
      {"name": "counterparty_name", "type": "text", "label": "Counterparty Name", "required": true},
      {"name": "msa_reference", "type": "text", "label": "MSA Reference/Date", "required": true, "placeholder": "MSA dated January 1, 2024"},
      {"name": "project_name", "type": "text", "label": "Project Name", "required": true},
      {"name": "project_description", "type": "textarea", "label": "Project Description", "required": true},
      {"name": "start_date", "type": "date", "label": "Start Date", "required": true},
      {"name": "end_date", "type": "date", "label": "End Date", "required": true},
      {"name": "total_value", "type": "number", "label": "Total Value ($)", "required": true, "min": 0},
      {"name": "billing_type", "type": "select", "label": "Billing Type", "required": true, "options": ["Fixed Price", "Time & Materials", "Monthly Retainer"], "default": "Fixed Price"},
      {"name": "deliverables", "type": "textarea", "label": "Key Deliverables", "required": true, "placeholder": "List key deliverables..."},
      {"name": "milestones", "type": "textarea", "label": "Payment Milestones", "placeholder": "Optional: Define payment milestones..."}
    ]'::jsonb,
    '{"default_approver": null, "value_thresholds": [{"above": 100000, "approvers": ["legal@mars.com"]}, {"above": 250000, "approvers": ["legal@mars.com", "cfo@mars.com"]}]}'::jsonb,
    40,
    'system'
  )
ON CONFLICT DO NOTHING;
