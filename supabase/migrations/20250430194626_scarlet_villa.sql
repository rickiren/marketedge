/*
  # Rename price column to high_of_day

  1. Changes
    - Rename 'price' column to 'high_of_day' in daily_highs table
    
  2. Security
    - Existing RLS policies will automatically apply to the renamed column
*/

ALTER TABLE daily_highs RENAME COLUMN price TO high_of_day;