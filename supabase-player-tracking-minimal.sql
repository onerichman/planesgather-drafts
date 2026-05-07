-- Minimal working migration for player tracking
-- Run this in your Supabase SQL Editor

-- Drop everything completely to ensure clean state
DROP TABLE IF EXISTS queue_participants CASCADE;
DROP FUNCTION IF EXISTS get_queue_participants(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS increment_queue_count(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_queue_current_count() CASCADE;

-- Create queue_participants table
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

-- Simple policies (no auth.users access needed)
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

-- Create indexes
CREATE INDEX idx_queue_participants_queue_id ON queue_participants(queue_id);
CREATE INDEX idx_queue_participants_user_id ON queue_participants(user_id);
CREATE INDEX idx_queue_participants_status ON queue_participants(status);

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
