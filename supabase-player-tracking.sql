-- Add player tracking functionality to draft_queues
-- Run this in your Supabase SQL Editor

-- First, let's add a new table for queue participants
CREATE TABLE IF NOT EXISTS queue_participants (
  id SERIAL PRIMARY KEY,
  queue_id INTEGER REFERENCES draft_queues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'enroute' CHECK (status IN ('enroute', 'at_store', 'withdrawn')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(queue_id, user_id) -- Prevent duplicate entries
);

-- Enable RLS for the new table
ALTER TABLE queue_participants ENABLE ROW LEVEL SECURITY;

-- Create policies for queue_participants
CREATE POLICY "Anyone can view queue participants" ON queue_participants
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add themselves to queues" ON queue_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue status" ON queue_participants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Store owners can update participants in their queues" ON queue_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM draft_queues 
      WHERE draft_queues.id = queue_participants.queue_id 
      AND EXISTS (
        SELECT 1 FROM stores 
        WHERE stores.id = draft_queues.store_id 
        AND owner_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_participants_queue_id ON queue_participants(queue_id);
CREATE INDEX IF NOT EXISTS idx_queue_participants_user_id ON queue_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_participants_status ON queue_participants(status);

-- Function to update current_count when participants change
CREATE OR REPLACE FUNCTION update_queue_current_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE draft_queues 
    SET current_count = (
      SELECT COUNT(*) 
      FROM queue_participants 
      WHERE queue_id = NEW.queue_id 
      AND status != 'withdrawn'
    )
    WHERE id = NEW.queue_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE draft_queues 
    SET current_count = (
      SELECT COUNT(*) 
      FROM queue_participants 
      WHERE queue_id = OLD.queue_id 
      AND status != 'withdrawn'
    )
    WHERE id = OLD.queue_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic current_count updates
CREATE TRIGGER update_queue_count_on_insert
  AFTER INSERT ON queue_participants
  FOR EACH ROW EXECUTE FUNCTION update_queue_current_count();

CREATE TRIGGER update_queue_count_on_update
  AFTER UPDATE ON queue_participants
  FOR EACH ROW EXECUTE FUNCTION update_queue_current_count();

CREATE TRIGGER update_queue_count_on_delete
  AFTER DELETE ON queue_participants
  FOR EACH ROW EXECUTE FUNCTION update_queue_current_count();

-- Function to get participant details with user info
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
    p.email,
    qp.status,
    qp.joined_at
  FROM queue_participants qp
  JOIN auth.users p ON qp.user_id = p.id
  WHERE qp.queue_id = queue_id_param
  AND qp.status != 'withdrawn'
  ORDER BY qp.joined_at ASC;
END;
$$ LANGUAGE plpgsql;

-- RPC function to increment queue count (for backward compatibility)
CREATE OR REPLACE FUNCTION increment_queue_count(queue_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE draft_queues 
  SET current_count = current_count + 1 
  WHERE id = queue_id_param;
END;
$$ LANGUAGE plpgsql;
