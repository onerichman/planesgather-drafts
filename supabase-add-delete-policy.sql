-- Add DELETE policy to allow users to delete their own participant records
-- Run this in your Supabase SQL Editor

CREATE POLICY "Users can delete their own participant records" ON queue_participants
  FOR DELETE USING (auth.uid() = user_id);
