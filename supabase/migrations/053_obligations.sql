-- Migration: 053_obligations.sql
-- Description: Creates obligation tracking tables for deadline monitoring and alerts

-- Contract obligations extracted from contracts
CREATE TABLE IF NOT EXISTS contract_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to contract (nullable for manually created obligations)
  contract_id UUID,
  contract_review_id UUID,
  contract_name TEXT NOT NULL,
  counterparty_name TEXT,

  -- Obligation details
  title TEXT NOT NULL,
  description TEXT,
  obligation_type TEXT CHECK (obligation_type IN (
    'payment',           -- Payment due dates
    'delivery',          -- Deliverable deadlines
    'notice',            -- Notice requirements (termination, renewal, etc.)
    'renewal',           -- Contract renewal decisions
    'termination',       -- Termination windows
    'reporting',         -- Periodic reporting requirements
    'insurance',         -- Insurance certificate renewals
    'compliance',        -- Compliance certifications
    'audit',             -- Audit rights/windows
    'milestone',         -- Project milestones
    'other'              -- Other obligations
  )) DEFAULT 'other',

  -- Timing
  due_date DATE,
  start_date DATE,                       -- For recurring obligations
  end_date DATE,                         -- When obligation expires

  -- Recurrence (null for one-time obligations)
  recurrence TEXT CHECK (recurrence IN (
    'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom'
  )),
  recurrence_interval INTEGER,           -- For custom: every N days
  recurrence_end_date DATE,              -- When recurrence stops

  -- Reminder configuration
  reminder_days INTEGER[] DEFAULT '{30, 7, 1}',  -- Days before due date to send reminders
  last_reminder_sent TIMESTAMPTZ,
  next_reminder_date DATE,

  -- Assignment
  assigned_to TEXT,                      -- Email of responsible person
  assigned_team TEXT,                    -- Team/department
  watchers TEXT[] DEFAULT '{}',          -- Additional people to notify

  -- Status tracking
  status TEXT CHECK (status IN (
    'pending',           -- Not yet due
    'upcoming',          -- Due within reminder window
    'due',               -- Due today
    'overdue',           -- Past due date
    'completed',         -- Marked as done
    'waived',            -- Obligation waived/removed
    'deferred'           -- Postponed
  )) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  completion_notes TEXT,

  -- AI extraction metadata
  ai_extracted BOOLEAN DEFAULT false,
  ai_confidence DECIMAL,                 -- 0-1 confidence score
  source_text TEXT,                      -- Original clause text
  extraction_review_status TEXT CHECK (extraction_review_status IN (
    'pending_review', 'confirmed', 'rejected', 'modified'
  )) DEFAULT 'pending_review',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,

  -- Priority and risk
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  financial_impact DECIMAL,              -- Estimated financial impact if missed

  -- Metadata
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_obligations_contract ON contract_obligations(contract_id);
CREATE INDEX IF NOT EXISTS idx_obligations_due_date ON contract_obligations(due_date);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON contract_obligations(status);
CREATE INDEX IF NOT EXISTS idx_obligations_assigned ON contract_obligations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_obligations_type ON contract_obligations(obligation_type);
CREATE INDEX IF NOT EXISTS idx_obligations_reminder ON contract_obligations(next_reminder_date) WHERE status IN ('pending', 'upcoming');
CREATE INDEX IF NOT EXISTS idx_obligations_overdue ON contract_obligations(due_date) WHERE status = 'overdue';

-- Obligation reminder log
CREATE TABLE IF NOT EXISTS obligation_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID REFERENCES contract_obligations(id) ON DELETE CASCADE,
  reminder_type TEXT CHECK (reminder_type IN (
    'scheduled',         -- Regular scheduled reminder
    'escalation',        -- Escalated due to approaching deadline
    'overdue',           -- Overdue notification
    'manual'             -- Manually triggered
  )) DEFAULT 'scheduled',
  sent_to TEXT[] NOT NULL,               -- Email addresses
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_subject TEXT,
  email_content TEXT,
  delivery_status TEXT CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'bounced')) DEFAULT 'sent'
);

-- Index for reminder history
CREATE INDEX IF NOT EXISTS idx_obligation_reminders_obligation ON obligation_reminders(obligation_id);
CREATE INDEX IF NOT EXISTS idx_obligation_reminders_sent ON obligation_reminders(sent_at);

-- Obligation completion history (for audit trail)
CREATE TABLE IF NOT EXISTS obligation_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID REFERENCES contract_obligations(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  completed_by TEXT NOT NULL,
  notes TEXT,
  attachments TEXT[],                    -- URLs to supporting documents
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for completion history
CREATE INDEX IF NOT EXISTS idx_obligation_completions_obligation ON obligation_completions(obligation_id);

-- Function to update obligation status based on due date
CREATE OR REPLACE FUNCTION update_obligation_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update status based on due date and current status
  IF NEW.status NOT IN ('completed', 'waived', 'deferred') THEN
    IF NEW.due_date < CURRENT_DATE THEN
      NEW.status := 'overdue';
    ELSIF NEW.due_date = CURRENT_DATE THEN
      NEW.status := 'due';
    ELSIF NEW.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN
      NEW.status := 'upcoming';
    ELSE
      NEW.status := 'pending';
    END IF;
  END IF;

  -- Calculate next reminder date
  IF NEW.status IN ('pending', 'upcoming') AND NEW.reminder_days IS NOT NULL AND array_length(NEW.reminder_days, 1) > 0 THEN
    -- Find the next reminder that hasn't been sent yet
    SELECT NEW.due_date - make_interval(days => d)
    INTO NEW.next_reminder_date
    FROM unnest(NEW.reminder_days) AS d
    WHERE NEW.due_date - make_interval(days => d) >= CURRENT_DATE
    ORDER BY d DESC
    LIMIT 1;
  ELSE
    NEW.next_reminder_date := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update status
DROP TRIGGER IF EXISTS trigger_update_obligation_status ON contract_obligations;
CREATE TRIGGER trigger_update_obligation_status
  BEFORE INSERT OR UPDATE ON contract_obligations
  FOR EACH ROW
  EXECUTE FUNCTION update_obligation_status();

-- Function to create recurrence instances
CREATE OR REPLACE FUNCTION create_recurring_obligation()
RETURNS TRIGGER AS $$
DECLARE
  next_due DATE;
  interval_val INTERVAL;
BEGIN
  -- Only process completed recurring obligations
  IF NEW.status = 'completed' AND NEW.recurrence IS NOT NULL AND OLD.status != 'completed' THEN
    -- Calculate interval based on recurrence type
    CASE NEW.recurrence
      WHEN 'daily' THEN interval_val := INTERVAL '1 day';
      WHEN 'weekly' THEN interval_val := INTERVAL '1 week';
      WHEN 'monthly' THEN interval_val := INTERVAL '1 month';
      WHEN 'quarterly' THEN interval_val := INTERVAL '3 months';
      WHEN 'annually' THEN interval_val := INTERVAL '1 year';
      WHEN 'custom' THEN interval_val := make_interval(days => COALESCE(NEW.recurrence_interval, 30));
    END CASE;

    next_due := NEW.due_date + interval_val;

    -- Only create if before end date
    IF NEW.recurrence_end_date IS NULL OR next_due <= NEW.recurrence_end_date THEN
      INSERT INTO contract_obligations (
        contract_id, contract_review_id, contract_name, counterparty_name,
        title, description, obligation_type, due_date,
        start_date, end_date, recurrence, recurrence_interval, recurrence_end_date,
        reminder_days, assigned_to, assigned_team, watchers,
        status, ai_extracted, source_text, priority, financial_impact, created_by
      ) VALUES (
        NEW.contract_id, NEW.contract_review_id, NEW.contract_name, NEW.counterparty_name,
        NEW.title, NEW.description, NEW.obligation_type, next_due,
        NEW.start_date, NEW.end_date, NEW.recurrence, NEW.recurrence_interval, NEW.recurrence_end_date,
        NEW.reminder_days, NEW.assigned_to, NEW.assigned_team, NEW.watchers,
        'pending', NEW.ai_extracted, NEW.source_text, NEW.priority, NEW.financial_impact, NEW.created_by
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for recurring obligations
DROP TRIGGER IF EXISTS trigger_create_recurring_obligation ON contract_obligations;
CREATE TRIGGER trigger_create_recurring_obligation
  AFTER UPDATE ON contract_obligations
  FOR EACH ROW
  EXECUTE FUNCTION create_recurring_obligation();

-- Daily function to update all obligation statuses (run via cron)
CREATE OR REPLACE FUNCTION refresh_obligation_statuses()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE contract_obligations
    SET updated_at = NOW()  -- Trigger will recalculate status
    WHERE status NOT IN ('completed', 'waived', 'deferred')
      AND (
        (due_date < CURRENT_DATE AND status != 'overdue')
        OR (due_date = CURRENT_DATE AND status != 'due')
        OR (due_date <= CURRENT_DATE + INTERVAL '7 days' AND due_date > CURRENT_DATE AND status != 'upcoming')
        OR (due_date > CURRENT_DATE + INTERVAL '7 days' AND status != 'pending')
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
