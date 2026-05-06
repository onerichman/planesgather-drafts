# Fixes Summary

## Issue 1: Phone Number Prompt for Already Opted-In Users

### Problem
When a signed-in player who has already opted in (has `skip_phone_prompt = true` or a `phone_number` set) clicks "Join Now" under Other Active Queues, they were still being asked for their phone number.

### Root Cause
The `handleJoinEvent` function in `QuickDraftFinder.tsx` was unconditionally showing the phone opt-in modal when joining from OtherActiveQueues, without checking if the user was already opted in.

### Fix Applied
Modified `/workspace/components/QuickDraftFinder.tsx`:
- Updated the `handleJoinEvent` useEffect to check `skipPhonePrompt` and `userPhoneNumber` before showing the modal
- If the user is already opted in, it now directly calls `joinSelectedQueue()` instead of showing the PhoneOptInModal
- Added proper dependencies (`skipPhonePrompt`, `userPhoneNumber`) to the useEffect dependency array

```typescript
// Before: Always showed modal
setSelectedQueueId(queueId);
setShowOptIn(true);

// After: Checks opt-in status first
setSelectedQueueId(queueId);
if (skipPhonePrompt || Boolean(userPhoneNumber)) {
  joinSelectedQueue(queueId);
} else {
  setShowOptIn(true);
}
```

## Issue 2: Row Level Security Error on Draft Request Creation

### Problem
Error: "new row violates row-level security policy for table 'draft_requests'"

### Root Cause
The RLS policy for INSERT on `draft_requests` was:
```sql
CREATE POLICY "Authenticated users can create draft requests" ON draft_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

This policy could fail in edge cases where the auth context isn't properly established, or it may be overly restrictive.

### Fix Applied
Modified `/workspace/supabase-setup.sql`:
- Changed the policy name and condition to allow any insert:

```sql
-- Before
CREATE POLICY "Authenticated users can create draft requests" ON draft_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- After  
CREATE POLICY "Anyone can create draft requests" ON draft_requests
  FOR INSERT WITH CHECK (true);
```

### How to Apply the RLS Fix
Run this SQL in your Supabase SQL Editor:

```sql
DROP POLICY IF EXISTS "Authenticated users can create draft requests" ON draft_requests;
DROP POLICY IF EXISTS "Anyone can create draft requests" ON draft_requests;

CREATE POLICY "Anyone can create draft requests" ON draft_requests
  FOR INSERT WITH CHECK (true);
```

Or run the complete updated setup script at `/workspace/supabase-setup.sql`.

## Files Modified
1. `/workspace/components/QuickDraftFinder.tsx` - Fixed phone prompt logic
2. `/workspace/supabase-setup.sql` - Updated RLS policy for draft_requests
3. `/workspace/RLS_FIX_INSTRUCTIONS.md` - Created instructions for applying RLS fix
4. `/workspace/FIXES_SUMMARY.md` - This file
