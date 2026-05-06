# SMS Verification Setup Guide

## For Production SMS Verification

To implement text verification instead of email verification, you'll need to integrate with an SMS service like Twilio.

### 1. Set up Twilio Account
1. Sign up at [twilio.com](https://twilio.com)
2. Get your Account SID, Auth Token, and a phone number
3. Install Twilio SDK: `npm install twilio`

### 2. Environment Variables
Add to your `.env.local`:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

### 3. Create SMS Verification Function
Create `lib/twilio.ts`:
```typescript
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendVerificationCode(phoneNumber: string, code: string) {
  try {
    await client.messages.create({
      body: `Your Planesgather verification code is: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phoneNumber,
    });
  } catch (error) {
    console.error('SMS send failed:', error);
    throw error;
  }
}
```

### 4. Modify Signup Components
Update the signup logic to:
1. Generate a verification code
2. Send SMS with the code
3. Store code temporarily (in database or Redis)
4. Show verification input field
5. Verify code before completing signup

### 5. Supabase Auth Settings
In your Supabase dashboard:
1. Go to Authentication > Settings
2. Disable "Enable email confirmations" (for easier signup during development)
3. Optionally configure SMS OTP if you want to add phone verification later

## Current Development Setup
For development, the app currently skips email verification for easier testing. Users can sign up and be immediately active.

## Database Setup
**For a fresh Supabase project:**
- Run `supabase-setup.sql` directly in your Supabase SQL Editor

**If you have existing Planesgather tables:**
1. Run `supabase-cleanup.sql` first (to drop existing tables)
2. Then run `supabase-setup.sql`

*Note: If cleanup gives "relation does not exist" errors, just run setup directly - your database is already clean.*

**Note**: The SQL setup has been updated to remove the `ALTER DATABASE` command that requires superuser privileges.