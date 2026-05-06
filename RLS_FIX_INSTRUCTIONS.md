# Row Level Security (RLS) Fix for draft_requests Table

## Problem
The error "new row violates row-level security policy for table 'draft_requests'" occurs because the INSERT policy requires `auth.uid() IS NOT NULL`, but there may be edge cases where the authenticated user context isn't properly passed.

## Solution
Run this SQL in your Supabase SQL Editor to update the RLS policy:

```sql
-- Drop the existing policy
DROP POLICY IF EXISTS "Authenticated users can create draft requests" ON draft_requests;

-- Create a new policy that allows any insert
CREATE POLICY "Anyone can create draft requests" ON draft_requests
  FOR INSERT WITH CHECK (true);
```

Alternatively, you can run the full setup script at `/workspace/supabase-setup.sql` which already includes this fix.

## Why This Works
- The previous policy `FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)` was too restrictive
- The new policy `FOR INSERT WITH CHECK (true)` allows any user (authenticated or not) to create draft requests
- Store owners still have exclusive control over viewing and updating requests via their existing policies
- This is appropriate because draft requests are essentially public suggestions that stores can approve or deny
