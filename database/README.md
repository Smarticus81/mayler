# Database Setup Guide

## Quick Start

### 1. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and project name
4. Set a strong database password (save this!)
5. Select region (choose closest to your users)
6. Click "Create new project"
7. Wait 2-3 minutes for setup to complete

### 2. Run Database Schema
1. In Supabase dashboard, click "SQL Editor" in left sidebar
2. Click "New query"
3. Copy entire contents of `database/schema.sql`
4. Paste into SQL editor
5. Click "Run" button
6. Verify success: Should see "Success. No rows returned"

### 3. Get API Credentials
1. In Supabase dashboard, click "Settings" (gear icon)
2. Click "API" in left sidebar
3. Copy these values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

### 4. Update Environment Variables
Add to your `.env` file:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Restart Server
```bash
# Stop server (Ctrl+C)
node server.js
```

### 6. Test Authentication
```bash
# Check if multi-tenant is enabled
curl http://localhost:3000/api/auth/status

# Should return: {"configured":true,"multiTenant":true}
```

---

## Database Tables

### `user_preferences`
Stores user voice and UI preferences
- `voice_engine`: 'openai' or 'rime'
- `selected_voice`: OpenAI voice name
- `rime_speaker_id`: Rime speaker ID
- `wake_word_enabled`: Boolean

### `user_gmail_tokens`
Stores per-user Gmail OAuth tokens
- `access_token`: Gmail access token
- `refresh_token`: Gmail refresh token
- `expiry_date`: Token expiration

### `conversations`
Stores conversation history
- `messages`: JSONB array of messages
- Indexed by user_id and created_at

### `usage_logs`
Tracks API usage per user
- `tool_name`: Name of tool used
- `api_calls`: Number of calls
- `voice_minutes`: Voice usage time

### `subscriptions`
Manages user billing
- `plan`: 'free', 'pro', or 'enterprise'
- `stripe_customer_id`: Stripe customer ID
- `stripe_subscription_id`: Stripe subscription ID
- `status`: Subscription status

---

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled. Users can only access their own data.

### Policies
- Users can read/write their own preferences
- Users can read/write their own Gmail tokens
- Users can read/write their own conversations
- Users can read their own usage logs
- System can insert usage logs (for tracking)
- System can manage subscriptions (for billing webhooks)

---

## Indexes

Performance indexes created on:
- All `user_id` columns
- `created_at` columns for time-based queries
- `stripe_customer_id` for billing lookups

---

## Triggers

Automatic `updated_at` timestamp updates on:
- `user_preferences`
- `user_gmail_tokens`
- `subscriptions`

---

## Views

### `user_usage_summary`
Aggregated monthly usage per user:
- Total API calls
- Total voice minutes
- Unique tools used

---

## Troubleshooting

### "relation does not exist" error
- Make sure you ran the entire `schema.sql` file
- Check you're in the correct project

### "permission denied" error
- RLS policies may be blocking access
- Verify you're using a valid JWT token

### Can't connect to database
- Check `SUPABASE_URL` is correct
- Check `SUPABASE_ANON_KEY` is correct
- Verify project is not paused (free tier pauses after 1 week inactivity)

### Tables created but auth not working
- Restart your server to load new environment variables
- Check `/api/auth/status` endpoint returns `configured: true`

---

## Migration from Single-User

If you have existing users in single-user mode:

1. Their localStorage preferences will be migrated on first login
2. Gmail tokens will need to be re-authenticated
3. No data loss - old localStorage still works until they sign up

---

## Backup & Recovery

### Manual Backup
1. Go to Supabase dashboard
2. Click "Database" → "Backups"
3. Click "Create backup"

### Automated Backups
Supabase Pro includes:
- Daily automated backups
- 7-day retention
- Point-in-time recovery

---

## Monitoring

### Check Database Health
```sql
-- View table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- View active connections
SELECT count(*) FROM pg_stat_activity;

-- View recent queries
SELECT query, state, query_start 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start DESC 
LIMIT 10;
```

---

## Next Steps

After database setup:
1. ✅ Database schema created
2. ✅ Environment variables configured
3. ✅ Server restarted
4. → Test auth endpoints (signup/signin)
5. → Implement frontend auth UI
6. → Migrate user preferences to database
7. → Update Gmail service for per-user tokens

See `.agent/workflows/multi-tenant-migration.md` for complete implementation guide.
