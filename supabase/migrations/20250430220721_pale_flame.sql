/*
  # Create running up alerts table for momentum tracking

  1. New Table
    - `running_up_alerts`
      - `id` (uuid, primary key)
      - `symbol` (text, not null)
      - `price` (real, not null)
      - `volume` (real, not null)
      - `timestamp` (timestamptz, not null)
      - `price_change_5m` (real)
      - `volume_ratio` (real)
      - `created_at` (timestamptz)

  2. Indexes
    - Index on symbol and timestamp for efficient querying
    - Index on timestamp for time-based queries

  3. Security
    - Enable RLS
    - Add policies for read/write access
*/

-- Create running_up_alerts table
CREATE TABLE IF NOT EXISTS running_up_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  price real NOT NULL,
  volume real NOT NULL,
  timestamp timestamptz NOT NULL,
  price_change_5m real,
  volume_ratio real,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS running_up_alerts_symbol_timestamp_idx 
  ON running_up_alerts (symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS running_up_alerts_timestamp_idx 
  ON running_up_alerts (timestamp DESC);

-- Enable RLS
ALTER TABLE running_up_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON running_up_alerts
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all users" ON running_up_alerts
  FOR INSERT WITH CHECK (true);

-- Add function to clean old data (older than 24 hours)
CREATE OR REPLACE FUNCTION clean_old_running_up_alerts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM running_up_alerts
  WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create a trigger to automatically clean old data
CREATE OR REPLACE FUNCTION trigger_clean_old_running_up_alerts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM clean_old_running_up_alerts();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clean_old_data_trigger
  AFTER INSERT ON running_up_alerts
  EXECUTE FUNCTION trigger_clean_old_running_up_alerts();