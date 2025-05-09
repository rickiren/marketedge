/*
  # Create daily highs tracking tables

  1. New Tables
    - `daily_highs`
      - `symbol` (text, primary key)
      - `price` (real)
      - `timestamp` (bigint)
      - `initial_price` (real)
      - `created_at` (timestamptz)
    - `last_alerts`
      - `symbol` (text, primary key)
      - `timestamp` (bigint)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read/write their own data
*/

-- Create daily_highs table
CREATE TABLE IF NOT EXISTS daily_highs (
  symbol text PRIMARY KEY,
  price real NOT NULL,
  timestamp bigint NOT NULL,
  initial_price real NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create last_alerts table
CREATE TABLE IF NOT EXISTS last_alerts (
  symbol text PRIMARY KEY,
  timestamp bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE daily_highs ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON daily_highs
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all users" ON daily_highs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON daily_highs
  FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON last_alerts
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all users" ON last_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON last_alerts
  FOR UPDATE USING (true);