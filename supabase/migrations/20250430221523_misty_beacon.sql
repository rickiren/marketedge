/*
  # Update running up alerts table structure

  1. Changes
    - Remove price_change_5m and volume_ratio columns
    - These values will be calculated dynamically when needed
    - Keep core data columns for time-series analysis

  2. Security
    - Existing RLS policies remain unchanged
*/

-- First drop the existing triggers and functions
DROP TRIGGER IF EXISTS clean_old_data_trigger ON running_up_alerts;
DROP FUNCTION IF EXISTS trigger_clean_old_running_up_alerts();
DROP FUNCTION IF EXISTS clean_old_running_up_alerts();

-- Recreate the table with the new structure
CREATE TABLE IF NOT EXISTS running_up_alerts_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  price real NOT NULL,
  volume real NOT NULL,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Copy data from old table to new table
INSERT INTO running_up_alerts_new (id, symbol, price, volume, timestamp, created_at)
SELECT id, symbol, price, volume, timestamp, created_at
FROM running_up_alerts;

-- Drop old table and rename new table
DROP TABLE running_up_alerts;
ALTER TABLE running_up_alerts_new RENAME TO running_up_alerts;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS running_up_alerts_symbol_timestamp_idx 
  ON running_up_alerts (symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS running_up_alerts_timestamp_idx 
  ON running_up_alerts (timestamp DESC);

CREATE INDEX IF NOT EXISTS running_up_alerts_symbol_time_window_idx 
  ON running_up_alerts (symbol, timestamp DESC, price, volume);

-- Enable RLS
ALTER TABLE running_up_alerts ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Enable read access for all users" ON running_up_alerts
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all users" ON running_up_alerts
  FOR INSERT WITH CHECK (true);

-- Recreate cleanup function
CREATE OR REPLACE FUNCTION clean_old_running_up_alerts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM running_up_alerts
  WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$;

-- Recreate trigger function
CREATE OR REPLACE FUNCTION trigger_clean_old_running_up_alerts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM clean_old_running_up_alerts();
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER clean_old_data_trigger
  AFTER INSERT ON running_up_alerts
  EXECUTE FUNCTION trigger_clean_old_running_up_alerts();