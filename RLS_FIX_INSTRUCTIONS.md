# Row Level Security (RLS) Fix for draft_requests Table

## Problem
The error "new row violates row-level security policy for table 'draft_requests'" occurs when trying to insert a new draft request. This happens because:
1. RLS is enabled on the `draft_requests` table
2. The existing INSERT policy may not be properly allowing authenticated users to create records

## Solution - Run This SQL in Supabase

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- First, drop any existing INSERT policies that might be conflicting
DROP POLICY IF EXISTS "Anyone can create draft requests" ON draft_requests;
DROP POLICY IF EXISTS "Authenticated users can create draft requests" ON draft_requests;

-- Create a new policy that explicitly allows inserts
CREATE POLICY "Allow anyone to create draft requests" ON draft_requests
  FOR INSERT 
  WITH CHECK (true);
```

## Verify the Fix

After running the SQL above, try creating a live draft request again. The error should be resolved.

## Why This Works

- The policy `FOR INSERT WITH CHECK (true)` allows any user (authenticated or anonymous) to create draft requests
- This is appropriate because draft requests are public suggestions that stores can approve or deny
- Store owners still have exclusive control over viewing and updating requests via their existing SELECT and UPDATE policies
- The fix ensures there's no conflict with other policies that might exist from previous setup attempts

## Additional Notes

If you continue to see errors:
1. Make sure RLS is enabled: `ALTER TABLE draft_requests ENABLE ROW LEVEL SECURITY;`
2. Check for any other conflicting policies in Supabase Dashboard → Authentication → Policies
3. Ensure your Supabase client is using the correct anon/public key
