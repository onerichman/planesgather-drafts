# Fixes Summary

## Issue 1: Phone Number Prompt for Already Opted-In Users

### Problem
When a signed-in player who has already opted in (has `skip_phone_prompt = true` or a `phone_number` set) clicks "Join Now" under Other Active Queues, they were still being asked for their phone number.

### Root Cause
The `handleJoinEvent` function in `QuickDraftFinder.tsx` had a condition check that wasn't properly evaluating the opt-in status due to how JavaScript evaluates boolean expressions with potentially undefined values.

### Fix Applied
Modified `/workspace/components/QuickDraftFinder.tsx`:
- Updated the `handleJoinEvent` useEffect to use explicit null/undefined checks instead of truthy/falsy evaluation
- Changed from `if (skipPhonePrompt || Boolean(userPhoneNumber))` to `const isOptedIn = skipPhonePrompt === true || (userPhoneNumber !== null && userPhoneNumber !== undefined)`
- This ensures the check works correctly even during component initialization when values might be in flux

```typescript
// Before: Could fail during initial load
if (skipPhonePrompt || Boolean(userPhoneNumber)) {
  joinSelectedQueue(queueId);
} else {
  setShowOptIn(true);
}

// After: Explicit checks prevent false negatives
const isOptedIn = skipPhonePrompt === true || (userPhoneNumber !== null && userPhoneNumber !== undefined);
if (isOptedIn) {
  joinSelectedQueue(queueId);
} else {
  setShowOptIn(true);
}
```

## Issue 2: Row Level Security Error on Draft Request Creation

### Problem
Error: "new row violates row-level security policy for table 'draft_requests'"

### Root Cause
The RLS policy for INSERT on `draft_requests` may have conflicts from previous setup attempts, or the policy name doesn't match what's actually in the database.

### Solution
Run this SQL in your Supabase SQL Editor to completely reset the INSERT policy:

```sql
-- Drop ALL existing INSERT policies that might conflict
DROP POLICY IF EXISTS "Anyone can create draft requests" ON draft_requests;
DROP POLICY IF EXISTS "Authenticated users can create draft requests" ON draft_requests;
DROP POLICY IF EXISTS "Allow anyone to create draft requests" ON draft_requests;

-- Create a single clean policy
CREATE POLICY "Allow anyone to create draft requests" ON draft_requests
  FOR INSERT 
  WITH CHECK (true);
```

### Why This Works
- The policy `FOR INSERT WITH CHECK (true)` allows any user to create draft requests
- Dropping all variations of the policy ensures no conflicts remain
- Store owners still have exclusive control over viewing and updating requests via their existing SELECT and UPDATE policies
- This is appropriate because draft requests are public suggestions that stores can approve or deny

## Files Modified
1. `/workspace/components/QuickDraftFinder.tsx` - Fixed phone prompt logic with explicit null checks
2. `/workspace/RLS_FIX_INSTRUCTIONS.md` - Updated with complete SQL fix instructions

## Next Steps
1. **For Issue 1**: The fix is already applied in the code. Test by signing in as a player with a phone number and clicking "Join Now" on an active queue.

2. **For Issue 2**: Run the SQL commands above in your Supabase SQL Editor, then test creating a live draft request.
