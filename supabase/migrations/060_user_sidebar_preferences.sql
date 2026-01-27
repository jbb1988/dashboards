-- Migration: User Sidebar Preferences
-- Allows users to customize which dashboards are pinned in their sidebar

-- Create the user_sidebar_preferences table
CREATE TABLE IF NOT EXISTS user_sidebar_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_dashboards TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment describing the table
COMMENT ON TABLE user_sidebar_preferences IS 'Stores user customization for sidebar pinned dashboards';
COMMENT ON COLUMN user_sidebar_preferences.pinned_dashboards IS 'Array of dashboard routes that are pinned (max 4, Home is always first)';

-- Enable RLS
ALTER TABLE user_sidebar_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own preferences
CREATE POLICY "Users can read own sidebar preferences"
  ON user_sidebar_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own sidebar preferences"
  ON user_sidebar_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update own sidebar preferences"
  ON user_sidebar_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own preferences
CREATE POLICY "Users can delete own sidebar preferences"
  ON user_sidebar_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_sidebar_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_sidebar_preferences_timestamp ON user_sidebar_preferences;
CREATE TRIGGER update_sidebar_preferences_timestamp
  BEFORE UPDATE ON user_sidebar_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_sidebar_preferences_updated_at();
