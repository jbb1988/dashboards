-- Migration: Add full-text search indexes for enhanced global search
-- Purpose: Enable fast full-text and fuzzy search across contracts, documents, and NetSuite tables

-- ============================================================================
-- STEP 1: Enable pg_trgm extension for fuzzy search (trigram similarity)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STEP 2: Add full-text search indexes for contracts
-- ============================================================================

-- Add GIN index for contracts full-text search
-- Combines name, account_name, opportunity_name, and sales_rep for comprehensive search
CREATE INDEX IF NOT EXISTS idx_contracts_search ON contracts
USING gin(to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(account_name, '') || ' ' ||
  coalesce(opportunity_name, '') || ' ' ||
  coalesce(sales_rep, '')
));

-- Add trigram index for fuzzy matching on account_name
CREATE INDEX IF NOT EXISTS idx_contracts_account_trgm ON contracts
USING gin(account_name gin_trgm_ops);

-- Add trigram index for fuzzy matching on name
CREATE INDEX IF NOT EXISTS idx_contracts_name_trgm ON contracts
USING gin(name gin_trgm_ops);

-- ============================================================================
-- STEP 3: Add full-text search indexes for documents
-- ============================================================================

-- Add GIN index for documents full-text search
CREATE INDEX IF NOT EXISTS idx_documents_search ON documents
USING gin(to_tsvector('english',
  coalesce(file_name, '') || ' ' ||
  coalesce(account_name, '') || ' ' ||
  coalesce(opportunity_name, '') || ' ' ||
  coalesce(notes, '') || ' ' ||
  coalesce(extracted_text, '')
));

-- Add trigram index for fuzzy matching on file_name
CREATE INDEX IF NOT EXISTS idx_documents_filename_trgm ON documents
USING gin(file_name gin_trgm_ops);

-- ============================================================================
-- STEP 4: Add full-text search indexes for NetSuite Work Orders
-- ============================================================================

-- Full-text search index for work orders
CREATE INDEX IF NOT EXISTS idx_ns_wo_search ON netsuite_work_orders
USING gin(to_tsvector('english',
  coalesce(wo_number, '') || ' ' ||
  coalesce(memo, '') || ' ' ||
  coalesce(customer_name, '') || ' ' ||
  coalesce(created_from_so_number, '')
));

-- Trigram index for fuzzy matching on wo_number
CREATE INDEX IF NOT EXISTS idx_ns_wo_number_trgm ON netsuite_work_orders
USING gin(wo_number gin_trgm_ops);

-- Trigram index for fuzzy matching on customer_name
CREATE INDEX IF NOT EXISTS idx_ns_wo_customer_trgm ON netsuite_work_orders
USING gin(customer_name gin_trgm_ops);

-- ============================================================================
-- STEP 5: Add full-text search indexes for NetSuite Sales Orders
-- ============================================================================

-- Full-text search index for sales orders
CREATE INDEX IF NOT EXISTS idx_ns_so_search ON netsuite_sales_orders
USING gin(to_tsvector('english',
  coalesce(so_number, '') || ' ' ||
  coalesce(memo, '') || ' ' ||
  coalesce(customer_name, '') || ' ' ||
  coalesce(sales_rep_name, '')
));

-- Trigram index for fuzzy matching on so_number
CREATE INDEX IF NOT EXISTS idx_ns_so_number_trgm ON netsuite_sales_orders
USING gin(so_number gin_trgm_ops);

-- Trigram index for fuzzy matching on customer_name
CREATE INDEX IF NOT EXISTS idx_ns_so_customer_trgm ON netsuite_sales_orders
USING gin(customer_name gin_trgm_ops);

-- ============================================================================
-- STEP 6: Add search helper function for relevance scoring
-- ============================================================================

-- Function to calculate search relevance score
CREATE OR REPLACE FUNCTION calculate_search_relevance(
  search_query TEXT,
  name_field TEXT,
  account_field TEXT,
  amount_field DECIMAL DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  lower_query TEXT := lower(search_query);
  lower_name TEXT := lower(coalesce(name_field, ''));
  lower_account TEXT := lower(coalesce(account_field, ''));
BEGIN
  -- Exact match in name: +100
  IF lower_name = lower_query THEN
    score := score + 100;
  -- Name starts with query: +75
  ELSIF lower_name LIKE lower_query || '%' THEN
    score := score + 75;
  -- Name contains query: +50
  ELSIF lower_name LIKE '%' || lower_query || '%' THEN
    score := score + 50;
  END IF;

  -- Account name match: +30
  IF lower_account LIKE '%' || lower_query || '%' THEN
    score := score + 30;
  END IF;

  -- Value weight: +log(value) capped at 20
  IF amount_field IS NOT NULL AND amount_field > 0 THEN
    score := score + LEAST(20, FLOOR(LOG(amount_field)));
  END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON INDEX idx_contracts_search IS 'GIN full-text search index for contracts (name, account, opportunity, sales_rep)';
COMMENT ON INDEX idx_contracts_account_trgm IS 'Trigram index for fuzzy matching on contract account names';
COMMENT ON INDEX idx_documents_search IS 'GIN full-text search index for documents (filename, account, opportunity, notes, extracted_text)';
COMMENT ON INDEX idx_ns_wo_search IS 'GIN full-text search index for NetSuite work orders';
COMMENT ON INDEX idx_ns_so_search IS 'GIN full-text search index for NetSuite sales orders';
COMMENT ON FUNCTION calculate_search_relevance IS 'Calculates search relevance score based on match type and value';

-- ============================================================================
-- Migration complete!
-- ============================================================================
