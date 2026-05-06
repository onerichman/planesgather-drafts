-- Supabase Setup SQL for Planesgather
-- Run these commands in your Supabase SQL Editor

-- Note: ALTER DATABASE requires superuser privileges and is not needed for Supabase
-- Supabase handles JWT secrets automatically

-- Drop existing tables if they exist (uncomment if you want to start fresh)
-- DROP TABLE IF EXISTS draft_requests CASCADE;
-- DROP TABLE IF EXISTS draft_queues CASCADE;
-- DROP TABLE IF EXISTS stores CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  user_type TEXT NOT NULL CHECK (user_type IN ('player', 'store')),
  -- Player fields
  companion_email TEXT,
  phone_number TEXT,
  skip_phone_prompt BOOLEAN DEFAULT false,
  -- Store fields
  store_name TEXT,
  address TEXT,
  website TEXT,
  capacity INTEGER,
  last_start_time TEXT,
  available_sets TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stores table
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  website TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  current_players INTEGER DEFAULT 0,
  max_capacity INTEGER,
  last_start_time TEXT DEFAULT '22:00',
  available_sets TEXT[] DEFAULT '{}',
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create draft_queues table for draft/commander queues
CREATE TABLE draft_queues (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('draft', 'commander')),
  store_id INTEGER REFERENCES stores(id),
  host_id UUID REFERENCES auth.users(id),
  name TEXT,
  label TEXT,
  max_players INTEGER DEFAULT 8,
  current_count INTEGER DEFAULT 0,
  queue_number INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'full', 'started', 'cancelled', 'canceled', 'firing', 'completed')),
  players JSONB DEFAULT '[]',
  firing_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create draft_requests table for player queue requests
CREATE TABLE draft_requests (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id),
  label TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure legacy or existing schema has required columns
ALTER TABLE IF EXISTS draft_queues
  ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES auth.users(id);
ALTER TABLE IF EXISTS stores
  ADD COLUMN IF NOT EXISTS current_players INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS draft_requests
  ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_requests ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Stores policies
CREATE POLICY "Store owners can view their own stores" ON stores
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Store owners can update their own stores" ON stores
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Store owners can insert their own stores" ON stores
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Anyone can view stores" ON stores
  FOR SELECT USING (true);

-- Draft queue policies
CREATE POLICY "Anyone can view draft queues" ON draft_queues
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create draft queues" ON draft_queues
  FOR INSERT WITH CHECK (auth.uid() = host_id OR host_id IS NULL);

CREATE POLICY "Queue hosts can update their own draft queues" ON draft_queues
  FOR UPDATE USING (auth.uid() = host_id);

-- Draft request policies
CREATE POLICY "Store owners can view requests for their store" ON draft_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM stores WHERE stores.id = draft_requests.store_id AND owner_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create draft requests" ON draft_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Store owners can update draft requests" ON draft_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM stores WHERE stores.id = draft_requests.store_id AND owner_id = auth.uid())
  );

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_type ON profiles(user_type);
CREATE INDEX idx_stores_owner_id ON stores(owner_id);
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_draft_queues_type ON draft_queues(type);
CREATE INDEX idx_draft_queues_status ON draft_queues(status);
CREATE INDEX idx_draft_queues_store_id ON draft_queues(store_id);
CREATE INDEX idx_draft_requests_store_id ON draft_requests(store_id);
CREATE INDEX idx_draft_requests_status ON draft_requests(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_draft_queues_updated_at BEFORE UPDATE ON draft_queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_draft_requests_updated_at BEFORE UPDATE ON draft_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();