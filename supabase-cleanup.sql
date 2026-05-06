-- Cleanup SQL - ONLY run this if you have EXISTING Planesgather tables
-- If you get "relation does not exist" errors, SKIP this and go directly to supabase-setup.sql
--
-- This will drop all Planesgather-related tables so you can start fresh

-- Drop tables in correct order (due to foreign key constraints)
DROP TABLE IF EXISTS queue_players CASCADE;
DROP TABLE IF EXISTS queues CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Also drop the function and triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
DROP TRIGGER IF EXISTS update_queues_updated_at ON queues;
DROP FUNCTION IF EXISTS update_updated_at_column();