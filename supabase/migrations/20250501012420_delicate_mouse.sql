/*
  # Fix database schema and functions

  1. Changes
    - Drop and recreate running_up_alerts table with proper structure
    - Recreate functions with better error handling
    - Add proper indexes for performance

  2. Security
    - Enable RLS
    - Add appropriate policies
*/

-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS clean_old_data_trigger ON running_up_alerts;
DROP FUNCTION IF EXISTS trigger_clean_old_running_up_alerts();
DROP FUNCTION IF EXISTS clean_old_running_up_alerts();
DROP FUNCTION IF EXISTS get_average_volume();
DROP FUNCTION IF EXISTS get_price_change_percentage();

-- Recreate running_up_alerts table
DROP TABLE IF EXISTS running_up_alerts;
CREATE TABLE running_up_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  price real NOT NULL,
  volume real NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX running_up_alerts_symbol_timestamp_idx 
  ON running_up_alerts (symbol, timestamp DESC);

CREATE INDEX running_up_alerts_timestamp_idx 
  ON running_up_alerts (timestamp DESC);

CREATE INDEX running_up_alerts_symbol_time_window_idx 
  ON running_up_alerts (symbol, timestamp DESC, price, volume);

-- Function to calculate average volume
CREATE OR REPLACE FUNCTION get_average_volume(
  p_symbol text,
  p_minutes integer DEFAULT 60
)
RETURNS real
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  avg_vol real;
BEGIN
  SELECT COALESCE(AVG(volume), 0)
  INTO avg_vol
  FROM running_up_alerts
  WHERE symbol = p_symbol
    AND timestamp >= NOW() - (p_minutes || ' minutes')::interval;
  
  RETURN avg_vol;
END;
$$;

-- Function to get price change percentage
CREATE OR REPLACE FUNCTION get_price_change_percentage(
  p_symbol text,
  p_minutes integer DEFAULT 5
)
RETURNS real
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_price real;
  end_price real;
BEGIN
  -- Get start and end prices
  WITH prices AS (
    SELECT price,
           timestamp,
           ROW_NUMBER() OVER (ORDER BY timestamp ASC) as first_row,
           ROW_NUMBER() OVER (ORDER BY timestamp DESC) as last_row
    FROM running_up_alerts
    WHERE symbol = p_symbol
      AND timestamp >= NOW() - (p_minutes || ' minutes')::interval
  )
  SELECT 
    MAX(CASE WHEN first_row = 1 THEN price END) as start_price,
    MAX(CASE WHEN last_row = 1 THEN price END) as end_price
  INTO start_price, end_price
  FROM prices;

  -- Calculate and return percentage change
  RETURN CASE 
    WHEN start_price IS NULL OR end_price IS NULL OR start_price = 0 THEN 0
    ELSE ((end_price - start_price) / start_price) * 100
  END;
END;
$$;

-- Function to clean old data
CREATE OR REPLACE FUNCTION clean_old_running_up_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM running_up_alerts
  WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$;

-- Trigger function for cleanup
CREATE OR REPLACE FUNCTION trigger_clean_old_running_up_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM clean_old_running_up_alerts();
  RETURN NEW;
END;
$$;

-- Create cleanup trigger
CREATE TRIGGER clean_old_data_trigger
  AFTER INSERT ON running_up_alerts
  EXECUTE FUNCTION trigger_clean_old_running_up_alerts();

-- Enable RLS
ALTER TABLE running_up_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON running_up_alerts
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all users" ON running_up_alerts
  FOR INSERT WITH CHECK (true);