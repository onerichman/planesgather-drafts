-- Simple migration for player tracking (avoids policy conflicts)
-- Run this in your Supabase SQL Editor

-- Only drop the table and recreate it (keep existing policies)
DROP TABLE IF EXISTS queue_participants CASCADE;

-- Recreate table
CREATE TABLE queue_participants (
  id SERIAL PRIMARY KEY,
  queue_id INTEGER REFERENCES draft_queues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'enroute' CHECK (status IN ('enroute', 'at_store', 'withdrawn')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(queue_id, user_id)
);

-- Enable RLS
ALTER TABLE queue_participants ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_queue_participants_queue_id ON queue_participants(queue_id);
CREATE INDEX idx_queue_participants_user_id ON queue_participants(user_id);
CREATE INDEX idx_queue_participants_status ON queue_participants(status);

-- Simple RPC function to get participants
CREATE OR REPLACE FUNCTION get_queue_participants(queue_id_param INTEGER)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  status TEXT,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qp.user_id,
    COALESCE(p.email, 'Unknown User') as email,
    qp.status,
    qp.joined_at
  FROM queue_participants qp
  LEFT JOIN auth.users p ON qp.user_id = p.id
  WHERE qp.queue_id = queue_id_param
  AND qp.status != 'withdrawn'
  ORDER BY qp.joined_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Simple trigger to update current_count
CREATE OR REPLACE FUNCTION update_queue_current_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE draft_queues 
  SET current_count = (
    SELECT COUNT(*) 
    FROM queue_participants 
    WHERE queue_id = COALESCE(NEW.queue_id, OLD.queue_id)
    AND status != 'withdrawn'
  )
  WHERE id = COALESCE(NEW.queue_id, OLD.queue_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_queue_count_on_insert
  AFTER INSERT ON queue_participants
  FOR EACH ROW EXECUTE FUNCTION update_queue_current_count();

CREATE TRIGGER update_queue_count_on_update
  AFTER UPDATE ON queue_participants
  FOR EACH ROW EXECUTE FUNCTION update_queue_current_count();

CREATE TRIGGER update_queue_count_on_delete
  AFTER DELETE ON queue_participants
  FOR EACH ROW EXECUTE FUNCTION update_queue_current_count();
