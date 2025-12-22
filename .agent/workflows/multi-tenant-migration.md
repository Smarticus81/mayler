---
description: Multi-Tenant Migration - Complete Implementation Guide
---

# Multi-Tenant Migration Workflow

This workflow guides the complete migration from single-user PWA to multi-tenant SaaS application.

## Prerequisites

- ✅ All 34 tools are working
- ✅ Voice pipelines (OpenAI + Rime) are functional
- ✅ Backend is modular and ready for scaling

## Phase 1: Database & Authentication Setup

### Step 1: Install Supabase
```bash
npm install @supabase/supabase-js
```

### Step 2: Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Copy project URL and anon key
4. Add to `.env`:
   ```
   SUPABASE_URL=your_project_url
   SUPABASE_ANON_KEY=your_anon_key
   ```

### Step 3: Create Database Schema
Run this SQL in Supabase SQL Editor:
```sql
-- Users table (Supabase Auth handles this)
-- We just need to extend it with our custom fields

-- User preferences
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    voice_engine VARCHAR DEFAULT 'openai',
    selected_voice VARCHAR DEFAULT 'alloy',
    rime_speaker_id VARCHAR DEFAULT 'marsh',
    wake_word_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Gmail tokens (per user)
CREATE TABLE user_gmail_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    expiry_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Conversation history
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_name VARCHAR,
    api_calls INTEGER DEFAULT 1,
    voice_minutes DECIMAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan VARCHAR DEFAULT 'free', -- free, pro, enterprise
    stripe_customer_id VARCHAR,
    stripe_subscription_id VARCHAR,
    status VARCHAR DEFAULT 'active',
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own gmail tokens" ON user_gmail_tokens
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own gmail tokens" ON user_gmail_tokens
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gmail tokens" ON user_gmail_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);
```

## Phase 2: Backend Authentication

### Step 4: Create Supabase Client
Create `backend/supabase.js`:
```javascript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);
```

### Step 5: Create Auth Middleware
Create `backend/middleware/auth.js`:
```javascript
import { supabase } from '../supabase.js';

export const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
};
```

### Step 6: Update All Routes
Add `authenticateUser` middleware to all protected routes in:
- `backend/routes/gmail.js`
- `backend/routes/calendar.js`
- `backend/routes/utility.js`
- `backend/routes/search.js`
- `backend/routes/chat.js`

Example:
```javascript
import { authenticateUser } from '../middleware/auth.js';

router.get('/emails', authenticateUser, async (req, res) => {
    const userId = req.user.id;
    // Use userId to fetch user-specific data
});
```

## Phase 3: Frontend Authentication

### Step 7: Install Supabase Client
```bash
npm install @supabase/supabase-js
```

### Step 8: Create Supabase Client
Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Step 9: Create Auth Context
Create `src/context/AuthContext.tsx`:
```typescript
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: any | null;
    session: any | null;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    return (
        <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
```

### Step 10: Create Login/Signup UI
Create `src/components/AuthModal.tsx` with login/signup forms.

### Step 11: Update API Calls
Modify all API calls to include auth token:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

const response = await fetch('/api/gmail/emails', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});
```

## Phase 4: User Preferences Migration

### Step 12: Migrate localStorage to Database
Update `MaylerContext.tsx` to sync with Supabase:
```typescript
// Load from database instead of localStorage
useEffect(() => {
    if (user) {
        loadUserPreferences(user.id);
    }
}, [user]);

// Save to database instead of localStorage
useEffect(() => {
    if (user) {
        saveUserPreferences(user.id, { selectedVoice, voiceEngine, etc });
    }
}, [selectedVoice, voiceEngine, etc]);
```

## Phase 5: Per-User Gmail Integration

### Step 13: Update Gmail Service
Modify `backend/gmail-service.js` to load tokens per user:
```javascript
async initializeForUser(userId) {
    const { data, error } = await supabase
        .from('user_gmail_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    if (data) {
        this.oauth2Client.setCredentials({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expiry_date: data.expiry_date
        });
    }
}
```

## Phase 6: Billing Integration

### Step 14: Install Stripe
```bash
npm install stripe
```

### Step 15: Create Stripe Routes
Create `backend/routes/billing.js` with checkout and webhook handlers.

### Step 16: Create Pricing Page
Create `src/components/PricingPage.tsx` with plan selection.

## Phase 7: Usage Tracking

### Step 17: Add Usage Middleware
Track API calls and voice minutes per user.

### Step 18: Implement Plan Limits
Check usage against plan limits before allowing API calls.

## Phase 8: Testing & Deployment

### Step 19: Test Multi-Tenant Features
- Create multiple test accounts
- Verify data isolation
- Test billing flow
- Test usage limits

### Step 20: Deploy
- Deploy to Railway/Vercel
- Set up environment variables
- Configure custom domain
- Enable SSL

## Success Criteria

- ✅ Users can sign up/login
- ✅ Each user has isolated data
- ✅ Gmail tokens are per-user
- ✅ Preferences sync across devices
- ✅ Billing works end-to-end
- ✅ Usage tracking is accurate
- ✅ Plan limits are enforced

## Estimated Timeline

- Phase 1-2: 2 days (Database + Backend Auth)
- Phase 3: 1 day (Frontend Auth)
- Phase 4-5: 2 days (User Data Migration)
- Phase 6: 2 days (Billing)
- Phase 7: 1 day (Usage Tracking)
- Phase 8: 1 day (Testing + Deployment)

**Total: ~9 days**
