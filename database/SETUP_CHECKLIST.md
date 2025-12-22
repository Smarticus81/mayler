# Supabase Setup Checklist

## ✅ Step 1: Project Linked
- [x] Supabase project created
- [x] Environment variables added to `.env`

## 📋 Step 2: Run Database Schema

### Option A: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Copy the entire contents of `database/schema.sql`
5. Paste into the SQL editor
6. Click **"Run"** (or press Ctrl+Enter)
7. Wait for completion (should take ~5 seconds)
8. Verify success: Should see "Success. No rows returned"

### Option B: Via Supabase CLI
```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## 🧪 Step 3: Verify Database Setup

Run this query in Supabase SQL Editor to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_preferences',
    'user_context',
    'user_gmail_tokens',
    'conversations',
    'smart_reminders',
    'quick_actions',
    'usage_logs',
    'subscriptions',
    'ai_insights',
    'integrations'
)
ORDER BY table_name;
```

**Expected result:** 10 tables listed

## 🔄 Step 4: Restart Server

The server needs to be restarted to load the new Supabase environment variables:

```bash
# Stop the current server (Ctrl+C in the terminal running node server.js)
# Then restart:
node server.js
```

## ✅ Step 5: Test Authentication

### Test 1: Check Multi-Tenant Status
```bash
curl http://localhost:3000/api/auth/status
```

**Expected response:**
```json
{
  "configured": true,
  "multiTenant": true
}
```

### Test 2: Create Test Account
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "user": { ... },
  "session": {
    "access_token": "eyJ...",
    ...
  },
  "message": "Account created successfully"
}
```

### Test 3: Sign In
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

### Test 4: Get User Profile
```bash
# Replace YOUR_TOKEN with the access_token from signup/signin
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "user": { ... },
  "preferences": {
    "voice_engine": "openai",
    "selected_voice": "alloy",
    ...
  },
  "subscription": {
    "plan": "free",
    "status": "active",
    ...
  },
  "multiTenant": true
}
```

## 🎉 Success Indicators

- ✅ All 10 tables created in Supabase
- ✅ `/api/auth/status` returns `configured: true`
- ✅ Can create new user accounts
- ✅ Can sign in and get JWT token
- ✅ User preferences and subscription auto-created
- ✅ Can fetch user profile with token

## 🐛 Troubleshooting

### "SUPABASE_URL is not defined"
- Check `.env` file has correct variables
- Restart server after adding variables

### "relation does not exist"
- Schema not run yet
- Run `database/schema.sql` in Supabase SQL Editor

### "Invalid API key"
- Check `SUPABASE_ANON_KEY` is correct
- Copy from Supabase Dashboard → Settings → API

### "Email already registered"
- User already exists
- Try different email or use signin instead

## 📊 Next Steps

Once authentication is working:

1. **Frontend Auth UI** - Create login/signup components
2. **User Context** - Start learning user preferences
3. **Smart Reminders** - Implement AI-suggested reminders
4. **Quick Actions** - Add voice shortcuts
5. **AI Insights** - Begin pattern analysis

---

**Current Status:** Database schema ready, waiting for schema execution
**Next Action:** Run `database/schema.sql` in Supabase SQL Editor
