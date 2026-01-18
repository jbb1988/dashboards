-- Create distributor metadata table to store total location counts and other info
DROP TABLE IF EXISTS distributor_metadata;

CREATE TABLE distributor_metadata (
  distributor_name TEXT PRIMARY KEY,
  total_locations INTEGER NOT NULL,
  headquarters TEXT,
  website TEXT,
  notes TEXT,
  last_verified_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert known distributor metadata from web research (January 2026)
INSERT INTO distributor_metadata (distributor_name, total_locations, headquarters, website, notes) VALUES
  ('Ferguson', 270, 'Newport News, VA', 'https://www.fergusonwaterworks.com', 'Waterworks division only - 270+ locations nationwide'),
  ('Core & Main', 370, 'St. Louis, MO', 'https://coreandmain.com', '370+ branches in 49 states'),
  ('HD Supply', 260, 'Atlanta, GA', 'https://hdsupply.com', '220 branches + 44 distribution centers'),
  ('Sonepar USA', 570, 'Charleston, SC', 'https://www.soneparusa.com', '570+ branches in all 50 states'),
  ('Winsupply', 660, 'Dayton, OH', 'https://www.winsupplyinc.com', '660+ local companies across U.S.'),
  ('Hajoca', 450, 'Conshohocken, PA', 'https://www.hajoca.com', '450+ locations under 60+ brand names'),
  ('Gexpro', 80, 'Shelton, CT', 'https://www.gexpro.com', '80+ warehouse storefront locations'),
  ('Rexel USA', 400, 'Dallas, TX', 'https://www.rexelusa.com', '400+ branches including Gexpro, Mayer Electric'),
  ('WinWholesale', 560, 'Dayton, OH', 'https://www.winwholesale.com', '560 locations in 45 states')
ON CONFLICT (distributor_name) DO UPDATE SET
  total_locations = EXCLUDED.total_locations,
  headquarters = EXCLUDED.headquarters,
  website = EXCLUDED.website,
  notes = EXCLUDED.notes,
  last_verified_date = CURRENT_DATE,
  updated_at = NOW();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_distributor_metadata_name ON distributor_metadata(distributor_name);

-- Add comment
COMMENT ON TABLE distributor_metadata IS 'Stores total location counts and metadata for distributors to calculate penetration rates';
