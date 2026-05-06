# Planesgather

A modern Magic: The Gathering draft and commander queue management app built with Next.js, Supabase, and Tailwind CSS.

## Features

- 🎲 **Draft & Commander Queues** - Find players for your favorite formats
- 🏪 **Store Management** - Stores can manage their draft events and settings
- 📱 **Player Profiles** - Sign up with companion app integration
- 🔐 **Authentication** - Secure login/signup with Supabase
- 📱 **SMS Verification** - Easy signup without email verification (production-ready for SMS)

## Setup Instructions

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Database Setup

**For a fresh Supabase project:**
- Run `supabase-setup.sql` directly in your Supabase SQL Editor

**If you have existing Planesgather tables:**
1. Run `supabase-cleanup.sql` first (to drop existing tables)
2. Then run `supabase-setup.sql`

*Note: If cleanup gives "relation does not exist" errors, just run setup directly - your database is already clean.*

### 3. Authentication Settings

In your Supabase dashboard:
1. Go to **Authentication → Settings**
2. **Disable "Enable email confirmations"** for easier signup
3. Optionally configure SMS OTP for production

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## SMS Verification Setup

For production SMS verification instead of email:
1. Sign up for [Twilio](https://twilio.com)
2. Add Twilio credentials to `.env.local`
3. Install Twilio: `npm install twilio`
4. Follow the setup guide in `SMS_SETUP.md`

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Real-time)
- **Deployment**: Vercel/Netlify ready

## Project Structure

```
app/
├── page.tsx              # Main landing page
├── auth/                  # Auth pages
├── join/                  # Player signup
├── reset-password/        # Password reset
└── store/[slug]/          # Store dashboard

components/
├── Login.tsx             # Authentication modal
├── PlayerSignUp.tsx      # Player registration
├── StoreSignUp.tsx       # Store registration
├── AvailabilityToggle.tsx # Player availability
└── ...

lib/
└── supabase.ts           # Supabase client

Database files:
├── supabase-setup.sql    # Database schema
├── supabase-cleanup.sql  # Cleanup existing tables
└── SMS_SETUP.md          # SMS verification guide
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run build`
5. Submit a pull request
