-- Mayler Multi-Tenant Database Schema - ENHANCED FOR MAGICAL EXPERIENCE
-- Run this in your Supabase SQL Editor

-- ============================================
-- USER PREFERENCES (Enhanced)
-- ============================================
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Voice Settings
    voice_engine VARCHAR DEFAULT 'openai',
    selected_voice VARCHAR DEFAULT 'alloy',
    rime_speaker_id VARCHAR DEFAULT 'marsh',
    wake_word_enabled BOOLEAN DEFAULT true,
    wake_word_custom VARCHAR, -- Allow custom wake words
    
    -- Personality & Behavior
    assistant_name VARCHAR DEFAULT 'Mayler',
    personality_mode VARCHAR DEFAULT 'professional', -- professional, friendly, concise, detailed
    response_style VARCHAR DEFAULT 'balanced', -- concise, balanced, detailed
    proactive_suggestions BOOLEAN DEFAULT true, -- AI suggests actions
    
    -- Context & Memory
    remember_context BOOLEAN DEFAULT true, -- Remember past conversations
    context_window_days INTEGER DEFAULT 30, -- How far back to remember
    
    -- Notifications & Alerts
    email_digest_enabled BOOLEAN DEFAULT false,
    email_digest_frequency VARCHAR DEFAULT 'daily', -- daily, weekly, never
    smart_notifications BOOLEAN DEFAULT true, -- AI decides what's important
    
    -- Privacy & Data
    share_analytics BOOLEAN DEFAULT true,
    voice_recordings_retention_days INTEGER DEFAULT 0, -- 0 = don't store
    
    -- UI Preferences
    theme VARCHAR DEFAULT 'dark', -- dark, light, auto
    language VARCHAR DEFAULT 'en',
    timezone VARCHAR DEFAULT 'UTC',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- USER CONTEXT (NEW - The Magic!)
-- ============================================
-- Stores learned information about the user for personalization
CREATE TABLE user_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Personal Information (learned from conversations)
    full_name VARCHAR,
    preferred_name VARCHAR,
    occupation VARCHAR,
    location VARCHAR,
    
    -- Preferences & Habits (AI learns these)
    typical_work_hours JSONB, -- {"start": "09:00", "end": "17:00", "timezone": "America/New_York"}
    communication_style VARCHAR, -- formal, casual, technical
    important_contacts JSONB, -- Frequently mentioned people
    recurring_tasks JSONB, -- Tasks user does regularly
    
    -- Goals & Projects
    active_goals JSONB, -- User's stated goals
    active_projects JSONB, -- Current projects
    
    -- Custom Facts (AI remembers user-specific info)
    custom_facts JSONB, -- {"favorite_color": "blue", "coffee_preference": "black", etc}
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- GMAIL TOKENS (Per User)
-- ============================================
CREATE TABLE user_gmail_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    expiry_date TIMESTAMP,
    email_address VARCHAR, -- Store user's Gmail address
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- CONVERSATIONS (Enhanced)
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Conversation Metadata
    title VARCHAR, -- AI-generated title
    summary TEXT, -- AI-generated summary
    messages JSONB, -- Full conversation
    
    -- Context & Categorization
    topics JSONB, -- ["email", "calendar", "weather"]
    sentiment VARCHAR, -- positive, neutral, negative
    importance VARCHAR DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Tools & Actions
    tools_used JSONB, -- Which tools were called
    actions_taken JSONB, -- What actions were performed
    
    -- Timestamps
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SMART REMINDERS (NEW - Proactive AI)
-- ============================================
CREATE TABLE smart_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Reminder Details
    title VARCHAR NOT NULL,
    description TEXT,
    reminder_type VARCHAR DEFAULT 'manual', -- manual, ai_suggested, recurring
    
    -- Timing
    remind_at TIMESTAMP NOT NULL,
    recurrence_rule VARCHAR, -- RRULE format for recurring reminders
    
    -- Context
    related_conversation_id UUID REFERENCES conversations(id),
    related_email_id VARCHAR, -- Gmail message ID
    related_calendar_event_id VARCHAR, -- Google Calendar event ID
    
    -- Status
    status VARCHAR DEFAULT 'pending', -- pending, completed, snoozed, dismissed
    completed_at TIMESTAMP,
    snoozed_until TIMESTAMP,
    
    -- AI Metadata
    ai_confidence DECIMAL, -- How confident AI is this reminder is useful
    ai_reasoning TEXT, -- Why AI suggested this
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- QUICK ACTIONS (NEW - User Shortcuts)
-- ============================================
CREATE TABLE quick_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Action Details
    name VARCHAR NOT NULL, -- "Daily standup email"
    description TEXT,
    voice_trigger VARCHAR, -- "send standup"
    
    -- Action Configuration
    action_type VARCHAR NOT NULL, -- email, calendar, search, custom
    action_config JSONB NOT NULL, -- Configuration for the action
    
    -- Usage Stats
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- AI Learning
    ai_suggested BOOLEAN DEFAULT false,
    ai_confidence DECIMAL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- USAGE TRACKING (Enhanced)
-- ============================================
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Usage Details
    tool_name VARCHAR,
    api_calls INTEGER DEFAULT 1,
    voice_minutes DECIMAL DEFAULT 0,
    
    -- Context
    conversation_id UUID REFERENCES conversations(id),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Performance
    response_time_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS & BILLING
-- ============================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Plan Details
    plan VARCHAR DEFAULT 'free', -- free, pro, enterprise
    plan_features JSONB, -- Dynamic feature flags
    
    -- Limits
    monthly_api_calls_limit INTEGER DEFAULT 1000,
    monthly_voice_minutes_limit INTEGER DEFAULT 60,
    
    -- Stripe Integration
    stripe_customer_id VARCHAR,
    stripe_subscription_id VARCHAR,
    status VARCHAR DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    
    -- Trial
    trial_ends_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- AI INSIGHTS (NEW - Learning & Patterns)
-- ============================================
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Insight Details
    insight_type VARCHAR NOT NULL, -- pattern, suggestion, optimization, warning
    title VARCHAR NOT NULL,
    description TEXT,
    
    -- Data
    insight_data JSONB, -- Supporting data
    confidence DECIMAL, -- AI confidence score
    
    -- Action
    suggested_action VARCHAR, -- What user should do
    action_taken BOOLEAN DEFAULT false,
    
    -- Lifecycle
    shown_to_user BOOLEAN DEFAULT false,
    dismissed BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INTEGRATIONS (NEW - Third-party connections)
-- ============================================
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Integration Details
    integration_type VARCHAR NOT NULL, -- gmail, calendar, slack, notion, etc
    integration_name VARCHAR,
    
    -- OAuth Tokens
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    
    -- Configuration
    config JSONB, -- Integration-specific settings
    
    -- Status
    status VARCHAR DEFAULT 'active', -- active, disconnected, error
    last_sync_at TIMESTAMP,
    sync_frequency VARCHAR DEFAULT 'realtime', -- realtime, hourly, daily
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - USER PREFERENCES
-- ============================================
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - USER CONTEXT
-- ============================================
CREATE POLICY "Users can view own context" ON user_context FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own context" ON user_context FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own context" ON user_context FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - GMAIL TOKENS
-- ============================================
CREATE POLICY "Users can view own gmail tokens" ON user_gmail_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own gmail tokens" ON user_gmail_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gmail tokens" ON user_gmail_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - CONVERSATIONS
-- ============================================
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON conversations FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - SMART REMINDERS
-- ============================================
CREATE POLICY "Users can manage own reminders" ON smart_reminders FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - QUICK ACTIONS
-- ============================================
CREATE POLICY "Users can manage own quick actions" ON quick_actions FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - USAGE LOGS
-- ============================================
CREATE POLICY "Users can view own usage" ON usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert usage logs" ON usage_logs FOR INSERT WITH CHECK (true);

-- ============================================
-- RLS POLICIES - SUBSCRIPTIONS
-- ============================================
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage subscriptions" ON subscriptions FOR ALL USING (true);

-- ============================================
-- RLS POLICIES - AI INSIGHTS
-- ============================================
CREATE POLICY "Users can view own insights" ON ai_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own insights" ON ai_insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert insights" ON ai_insights FOR INSERT WITH CHECK (true);

-- ============================================
-- RLS POLICIES - INTEGRATIONS
-- ============================================
CREATE POLICY "Users can manage own integrations" ON integrations FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_context_user_id ON user_context(user_id);
CREATE INDEX idx_user_gmail_tokens_user_id ON user_gmail_tokens(user_id);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_importance ON conversations(importance);
CREATE INDEX idx_conversations_topics ON conversations USING GIN (topics);

CREATE INDEX idx_smart_reminders_user_id ON smart_reminders(user_id);
CREATE INDEX idx_smart_reminders_remind_at ON smart_reminders(remind_at);
CREATE INDEX idx_smart_reminders_status ON smart_reminders(status);

CREATE INDEX idx_quick_actions_user_id ON quick_actions(user_id);
CREATE INDEX idx_quick_actions_voice_trigger ON quick_actions(voice_trigger);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_conversation_id ON usage_logs(conversation_id);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX idx_ai_insights_shown_dismissed ON ai_insights(shown_to_user, dismissed);
CREATE INDEX idx_ai_insights_created_at ON ai_insights(created_at DESC);

CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE INDEX idx_integrations_type ON integrations(integration_type);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_context_updated_at BEFORE UPDATE ON user_context FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_gmail_tokens_updated_at BEFORE UPDATE ON user_gmail_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_smart_reminders_updated_at BEFORE UPDATE ON smart_reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quick_actions_updated_at BEFORE UPDATE ON quick_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR ANALYTICS & INSIGHTS
-- ============================================

-- User usage summary
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT 
    user_id,
    DATE_TRUNC('month', created_at) as month,
    SUM(api_calls) as total_api_calls,
    SUM(voice_minutes) as total_voice_minutes,
    COUNT(DISTINCT tool_name) as unique_tools_used,
    AVG(response_time_ms) as avg_response_time_ms,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*)::FLOAT as success_rate
FROM usage_logs
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- Active reminders view
CREATE OR REPLACE VIEW active_reminders AS
SELECT 
    sr.*,
    up.timezone
FROM smart_reminders sr
JOIN user_preferences up ON sr.user_id = up.user_id
WHERE sr.status = 'pending'
AND sr.remind_at <= NOW() + INTERVAL '1 hour'
ORDER BY sr.remind_at ASC;

-- User engagement score
CREATE OR REPLACE VIEW user_engagement AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT DATE(c.created_at)) as active_days,
    SUM(ul.api_calls) as total_api_calls,
    SUM(ul.voice_minutes) as total_voice_minutes,
    COUNT(qa.id) as quick_actions_created,
    COUNT(sr.id) as reminders_created,
    CASE 
        WHEN COUNT(DISTINCT DATE(c.created_at)) > 20 THEN 'power_user'
        WHEN COUNT(DISTINCT DATE(c.created_at)) > 7 THEN 'active'
        WHEN COUNT(DISTINCT DATE(c.created_at)) > 0 THEN 'casual'
        ELSE 'inactive'
    END as engagement_level
FROM auth.users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN usage_logs ul ON u.id = ul.user_id
LEFT JOIN quick_actions qa ON u.id = qa.user_id
LEFT JOIN smart_reminders sr ON u.id = sr.user_id
GROUP BY u.id, u.email;

-- ============================================
-- SCHEMA COMPLETE
-- ============================================

-- Verify tables were created
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
