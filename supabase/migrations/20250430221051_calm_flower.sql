/*
  # Optimize running up alerts table

  1. Changes
    - Add composite index for efficient time-window queries
    - Add function to calculate average volume
    - Add function to get price change percentage

  2. Security
    - Functions inherit existing RLS policies
*/

-- Add composite index for time-window queries
CREATE INDEX IF NOT EXISTS running_up_alerts_symbol_time_window_idx 
  ON running_up_alerts (symbol, timestamp DESC, price, volume);

-- Function to calculate average volume for a symbol over a time window
CREATE OR REPLACE FUNCTION get_average_volume(
  p_symbol text,
  p_minutes integer
)
RETURNS real
LANGUAGE plpgsql
AS $$
DECLARE
  avg_vol real;
BEGIN
  SELECT AVG(volume)
  INTO avg_vol
  FROM running_up_alerts
  WHERE symbol = p_symbol
    AND timestamp >= NOW() - (p_minutes || ' minutes')::interval;
  
  RETURN COALESCE(avg_vol, 0);
END;
$$;

-- Function to get price change percentage over time window
CREATE OR REPLACE FUNCTION get_price_change_percentage(
  p_symbol text,
  p_minutes integer
)
RETURNS real
LANGUAGE plpgsql
AS $$
DECLARE
  start_price real;
  end_price real;
  change_pct real;
BEGIN
  -- Get oldest price in window
  SELECT price
  INTO start_price
  FROM running_up_alerts
  WHERE symbol = p_symbol
    AND timestamp >= NOW() - (p_minutes || ' minutes')::interval
  ORDER BY timestamp ASC
  LIMIT 1;

  -- Get newest price in window
  SELECT price
  INTO end_price
  FROM running_up_alerts
  WHERE symbol = p_symbol
    AND timestamp >= NOW() - (p_minutes || ' minutes')::interval
  ORDER BY timestamp DESC
  LIMIT 1;

  -- Calculate percentage change
  IF start_price IS NOT NULL AND end_price IS NOT NULL AND start_price > 0 THEN
    change_pct := ((end_price - start_price) / start_price) * 100;
  ELSE
    change_pct := 0;
  END IF;

  RETURN change_pct;
END;
$$;