-- Migration: Create distributor_metadata table for caching location extraction and growth scores
-- This supports the Distributors tab in the diversified products dashboard

-- Create distributor_metadata table
CREATE TABLE IF NOT EXISTS distributor_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  distributor_name VARCHAR(100) NOT NULL,

  -- Location extraction results
  extracted_location VARCHAR(100),
  extracted_state VARCHAR(2),
  location_confidence INTEGER CHECK (location_confidence >= 0 AND location_confidence <= 100),
  location_verified BOOLEAN DEFAULT FALSE,
  location_override VARCHAR(100),  -- Manual correction if extraction is wrong

  -- Cached performance metrics (updated daily)
  cached_revenue DECIMAL(15,2),
  cached_margin_pct DECIMAL(5,2),
  cached_yoy_change_pct DECIMAL(5,2),
  cached_growth_score INTEGER CHECK (cached_growth_score >= 0 AND cached_growth_score <= 100),
  cached_growth_tier VARCHAR(10) CHECK (cached_growth_tier IN ('high', 'medium', 'low')),

  -- Metadata
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one record per customer-distributor combination
  UNIQUE(customer_id, distributor_name)
);

-- Create indexes for performance
CREATE INDEX idx_dist_meta_distributor ON distributor_metadata(distributor_name);
CREATE INDEX idx_dist_meta_location ON distributor_metadata(extracted_location);
CREATE INDEX idx_dist_meta_growth_score ON distributor_metadata(cached_growth_score DESC);
CREATE INDEX idx_dist_meta_customer ON distributor_metadata(customer_id);
CREATE INDEX idx_dist_meta_verified ON distributor_metadata(location_verified) WHERE location_verified = FALSE;

-- Add indexes to diversified_sales for faster distributor queries
CREATE INDEX IF NOT EXISTS idx_diversified_customer_date ON diversified_sales(customer_name, transaction_date);
CREATE INDEX IF NOT EXISTS idx_diversified_customer_year_class ON diversified_sales(customer_name, year, class_category);

-- Add comment
COMMENT ON TABLE distributor_metadata IS 'Caches location extraction results and growth scores for distributor locations in the diversified dashboard';
