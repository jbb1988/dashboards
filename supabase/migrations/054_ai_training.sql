-- Migration: 054_ai_training.sql
-- Description: Creates tables for AI feedback collection, terminology glossary, and few-shot examples

-- AI feedback on suggestions
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Context
  review_id UUID,                        -- Contract review this feedback relates to
  contract_name TEXT,
  clause_type TEXT,                      -- Type of clause being evaluated
  section_title TEXT,

  -- The AI suggestion being rated
  ai_suggestion TEXT NOT NULL,
  original_text TEXT,                    -- Original clause text (for context)

  -- User feedback
  rating TEXT CHECK (rating IN ('positive', 'negative', 'neutral')) NOT NULL,
  rating_reason TEXT,                    -- Why user gave this rating

  -- Correction (for negative ratings)
  corrected_text TEXT,                   -- User's preferred version
  correction_notes TEXT,                 -- Explanation of what was wrong

  -- Use for training
  use_for_training BOOLEAN DEFAULT true,
  training_category TEXT,                -- Category for organizing training data

  -- Metadata
  submitted_by TEXT NOT NULL,
  submitted_by_role TEXT,                -- 'legal', 'business', 'admin'
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feedback queries
CREATE INDEX IF NOT EXISTS idx_ai_feedback_review ON ai_feedback(review_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON ai_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_clause_type ON ai_feedback(clause_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_training ON ai_feedback(use_for_training) WHERE use_for_training = true;
CREATE INDEX IF NOT EXISTS idx_ai_feedback_date ON ai_feedback(submitted_at);

-- Company-specific terminology glossary
CREATE TABLE IF NOT EXISTS company_terminology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,

  -- Usage guidance
  preferred_usage TEXT,                  -- Example of correct usage
  avoid_usage TEXT[],                    -- Terms/phrases to avoid (synonyms that shouldn't be used)
  context TEXT,                          -- When this term applies

  -- Categorization
  category TEXT,                         -- 'legal', 'technical', 'business', 'product'
  domain TEXT,                           -- 'contracts', 'services', 'products'

  -- For term replacement/standardization
  aliases TEXT[],                        -- Alternative terms that should map to this
  is_preferred BOOLEAN DEFAULT true,     -- Is this the preferred term?

  -- Status
  is_active BOOLEAN DEFAULT true,
  requires_review BOOLEAN DEFAULT false,

  -- Metadata
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on term (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_terminology_term_unique ON company_terminology(LOWER(term));

-- Indexes for terminology queries
CREATE INDEX IF NOT EXISTS idx_terminology_category ON company_terminology(category);
CREATE INDEX IF NOT EXISTS idx_terminology_active ON company_terminology(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_terminology_aliases ON company_terminology USING GIN(aliases);

-- Full-text search on terminology
CREATE INDEX IF NOT EXISTS idx_terminology_search ON company_terminology
  USING GIN(to_tsvector('english', coalesce(term, '') || ' ' || coalesce(definition, '')));

-- Few-shot examples for AI prompts
CREATE TABLE IF NOT EXISTS few_shot_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task categorization
  task_type TEXT NOT NULL,               -- 'clause_review', 'risk_assessment', 'redline', 'extraction'
  clause_category TEXT,                  -- 'indemnification', 'liability', etc.
  scenario_type TEXT,                    -- 'vendor_agreement', 'customer_contract', etc.

  -- The example
  input_example TEXT NOT NULL,           -- Input to the AI
  output_example TEXT NOT NULL,          -- Expected/ideal output
  explanation TEXT,                      -- Why this is a good example

  -- Quality indicators
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5),
  times_used INTEGER DEFAULT 0,
  success_rate DECIMAL,                  -- Measured improvement when used

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,            -- Higher priority = used first
  max_uses_per_prompt INTEGER DEFAULT 3, -- Limit uses in single prompt

  -- Source tracking
  source_contract_id UUID,
  source_contract_name TEXT,
  derived_from_feedback_id UUID REFERENCES ai_feedback(id),

  -- Metadata
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for few-shot queries
CREATE INDEX IF NOT EXISTS idx_few_shot_task ON few_shot_examples(task_type);
CREATE INDEX IF NOT EXISTS idx_few_shot_clause ON few_shot_examples(clause_category);
CREATE INDEX IF NOT EXISTS idx_few_shot_active ON few_shot_examples(is_active, priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_few_shot_quality ON few_shot_examples(quality_score DESC) WHERE is_active = true;

-- Track which few-shot examples are used in prompts
CREATE TABLE IF NOT EXISTS few_shot_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  example_id UUID REFERENCES few_shot_examples(id) ON DELETE CASCADE,
  review_id UUID,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  -- Track effectiveness
  feedback_received BOOLEAN DEFAULT false,
  feedback_positive BOOLEAN
);

-- Index for usage tracking
CREATE INDEX IF NOT EXISTS idx_few_shot_usage_example ON few_shot_usage(example_id);
CREATE INDEX IF NOT EXISTS idx_few_shot_usage_date ON few_shot_usage(used_at);

-- Function to increment few-shot usage count
CREATE OR REPLACE FUNCTION increment_few_shot_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE few_shot_examples
  SET times_used = times_used + 1,
      updated_at = NOW()
  WHERE id = NEW.example_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for usage tracking
DROP TRIGGER IF EXISTS trigger_increment_few_shot_usage ON few_shot_usage;
CREATE TRIGGER trigger_increment_few_shot_usage
  AFTER INSERT ON few_shot_usage
  FOR EACH ROW
  EXECUTE FUNCTION increment_few_shot_usage();

-- Function to update success rate based on feedback
CREATE OR REPLACE FUNCTION update_few_shot_success_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.feedback_received AND NOT OLD.feedback_received THEN
    UPDATE few_shot_examples
    SET success_rate = (
      SELECT AVG(CASE WHEN feedback_positive THEN 1.0 ELSE 0.0 END)
      FROM few_shot_usage
      WHERE example_id = NEW.example_id AND feedback_received = true
    ),
    updated_at = NOW()
    WHERE id = NEW.example_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for success rate updates
DROP TRIGGER IF EXISTS trigger_update_few_shot_success ON few_shot_usage;
CREATE TRIGGER trigger_update_few_shot_success
  AFTER UPDATE ON few_shot_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_few_shot_success_rate();

-- Update timestamp trigger for terminology
CREATE OR REPLACE FUNCTION update_terminology_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_terminology_timestamp ON company_terminology;
CREATE TRIGGER trigger_update_terminology_timestamp
  BEFORE UPDATE ON company_terminology
  FOR EACH ROW
  EXECUTE FUNCTION update_terminology_timestamp();

-- Update timestamp trigger for few-shot examples
DROP TRIGGER IF EXISTS trigger_update_few_shot_timestamp ON few_shot_examples;
CREATE TRIGGER trigger_update_few_shot_timestamp
  BEFORE UPDATE ON few_shot_examples
  FOR EACH ROW
  EXECUTE FUNCTION update_terminology_timestamp();

-- Seed some initial company terminology
INSERT INTO company_terminology (term, definition, preferred_usage, category, domain, created_by) VALUES
  ('MARS', 'MARS Company - the contracting party', 'Use "MARS" rather than "Company" or "Client" when referring to our organization', 'business', 'contracts', 'system'),
  ('Consultant', 'Third-party service provider engaged by MARS', 'Preferred over "Vendor" or "Contractor" for professional services', 'legal', 'contracts', 'system'),
  ('Work Product', 'Deliverables created under a contract', 'All custom work created for MARS under the agreement', 'legal', 'contracts', 'system'),
  ('Confidential Information', 'Protected information disclosed between parties', 'Information marked confidential or reasonably understood to be confidential', 'legal', 'contracts', 'system'),
  ('Net 30', 'Payment due within 30 days of invoice', 'MARS standard payment terms', 'business', 'contracts', 'system'),
  ('Limitation of Liability', 'Cap on damages recoverable under contract', 'Should be capped at contract value for direct damages only', 'legal', 'contracts', 'system'),
  ('Mutual Indemnification', 'Both parties indemnify each other proportionally', 'MARS standard position - reject one-way indemnification', 'legal', 'contracts', 'system')
ON CONFLICT DO NOTHING;

-- Seed initial few-shot examples
INSERT INTO few_shot_examples (task_type, clause_category, input_example, output_example, explanation, quality_score, created_by) VALUES
  (
    'risk_assessment',
    'indemnification',
    'Client shall indemnify, defend, and hold harmless Vendor from any and all claims, damages, losses, and expenses arising from Client''s use of the services.',
    '{"risk_level": "high", "issue": "One-sided indemnification favoring vendor", "recommendation": "Negotiate for mutual indemnification proportionate to each party''s fault", "suggested_language": "Each party shall indemnify the other against third-party claims arising from the indemnifying party''s negligence or willful misconduct."}',
    'Demonstrates proper identification of one-sided indemnification and appropriate mutual alternative',
    5,
    'system'
  ),
  (
    'risk_assessment',
    'limitation_of_liability',
    'IN NO EVENT SHALL VENDOR''S TOTAL LIABILITY EXCEED ONE HUNDRED DOLLARS ($100). VENDOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES.',
    '{"risk_level": "high", "issue": "Liability cap unreasonably low and excludes all meaningful damages", "recommendation": "Cap should be at least equal to fees paid; consequential damages exclusion is acceptable if mutual", "suggested_language": "Neither party''s total liability shall exceed the greater of fees paid in the twelve months preceding the claim or $50,000. Neither party shall be liable for indirect or consequential damages, except for breaches of confidentiality or indemnification obligations."}',
    'Shows proper risk identification for unfair liability caps with balanced alternative',
    5,
    'system'
  ),
  (
    'clause_review',
    'termination',
    'Either party may terminate this Agreement for convenience upon thirty (30) days'' written notice.',
    '{"acceptable": true, "notes": "Standard mutual termination for convenience clause. Ensure payment for work performed through termination date is addressed elsewhere in the agreement."}',
    'Example of acceptable clause that should not be flagged as high risk',
    4,
    'system'
  )
ON CONFLICT DO NOTHING;
