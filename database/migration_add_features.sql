-- Migration: Add Enhanced Features to Existing Schema
-- Run this if you already have basic tables from the old schema

-- ============================================
-- ADD NEW COLUMNS TO user_preferences
-- ============================================
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS wake_word_custom VARCHAR,
ADD COLUMN IF NOT EXISTS assistant_name VARCHAR DEFAULT 'Mayler',
ADD COLUMN IF NOT EXISTS personality_mode VARCHAR DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS response_style VARCHAR DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS proactive_suggestions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS remember_context BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS context_window_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_digest_frequency VARCHAR DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS smart_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS share_analytics BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS voice_recordings_retention_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS theme VARCHAR DEFAULT 'dark',
ADD COLUMN IF NOT EXISTS language VARCHAR DEFAULT 'en',
ADD COLUMN IF NOT EXISTS timezone VARCHAR DEFAULT 'UTC';

-- ============================================
-- ADD email_address TO user_gmail_tokens
-- ============================================
ALTER TABLE user_gmail_tokens 
ADD COLUMN IF NOT EXISTS email_address VARCHAR;

-- ============================================
-- ADD NEW COLUMNS TO conversations
-- ============================================
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS title VARCHAR,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS topics JSONB,
ADD COLUMN IF NOT EXISTS sentiment VARCHAR,
ADD COLUMN IF NOT EXISTS importance VARCHAR DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS tools_used JSONB,
ADD COLUMN IF NOT EXISTS actions_taken JSONB,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;

-- ============================================
-- ADD NEW COLUMNS TO usage_logs
-- ============================================
ALTER TABLE usage_logs 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id),
ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- ============================================
-- ADD NEW COLUMNS TO subscriptions
-- ============================================
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS plan_features JSONB,
ADD COLUMN IF NOT EXISTS monthly_api_calls_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS monthly_voice_minutes_limit INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;

-- ============================================
-- CREATE NEW TABLES
-- ============================================

-- User Context (AI Learning)
CREATE TABLE IF NOT EXISTS user_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR,
    preferred_name VARCHAR,
    occupation VARCHAR,
    location VARCHAR,
    typical_work_hours JSONB,
    communication_style VARCHAR,
    important_contacts JSONB,
    recurring_tasks JSONB,
    active_goals JSONB,
    active_projects JSONB,
    custom_facts JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Smart Reminders
CREATE TABLE IF NOT EXISTS smart_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    reminder_type VARCHAR DEFAULT 'manual',
    remind_at TIMESTAMP NOT NULL,
    recurrence_rule VARCHAR,
    related_conversation_id UUID REFERENCES conversations(id),
    related_email_id VARCHAR,
    related_calendar_event_id VARCHAR,
    status VARCHAR DEFAULT 'pending',
    completed_at TIMESTAMP,
    snoozed_until TIMESTAMP,
    ai_confidence DECIMAL,
    ai_reasoning TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Quick Actions
CREATE TABLE IF NOT EXISTS quick_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    voice_trigger VARCHAR,
    action_type VARCHAR NOT NULL,
    action_config JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    ai_suggested BOOLEAN DEFAULT false,
    ai_confidence DECIMAL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Insights
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    insight_data JSONB,
    confidence DECIMAL,
    suggested_action VARCHAR,
    action_taken BOOLEAN DEFAULT false,
    shown_to_user BOOLEAN DEFAULT false,
    dismissed BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    integration_type VARCHAR NOT NULL,
    integration_name VARCHAR,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    config JSONB,
    status VARCHAR DEFAULT 'active',
    last_sync_at TIMESTAMP,
    sync_frequency VARCHAR DEFAULT 'realtime',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================
DROP POLICY IF EXISTS "Users can view own context" ON user_context;
CREATE POLICY "Users can view own context" ON user_context FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own context" ON user_context;
CREATE POLICY "Users can update own context" ON user_context FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own context" ON user_context;
CREATE POLICY "Users can insert own context" ON user_context FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own reminders" ON smart_reminders;
CREATE POLICY "Users can manage own reminders" ON smart_reminders FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own quick actions" ON quick_actions;
CREATE POLICY "Users can manage own quick actions" ON quick_actions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own insights" ON ai_insights;
CREATE POLICY "Users can view own insights" ON ai_insights FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own insights" ON ai_insights;
CREATE POLICY "Users can update own insights" ON ai_insights FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert insights" ON ai_insights;
CREATE POLICY "System can insert insights" ON ai_insights FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage own integrations" ON integrations;
CREATE POLICY "Users can manage own integrations" ON integrations FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON user_context(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_topics ON conversations USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_conversations_importance ON conversations(importance);

CREATE INDEX IF NOT EXISTS idx_smart_reminders_user_id ON smart_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_reminders_remind_at ON smart_reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_smart_reminders_status ON smart_reminders(status);

CREATE INDEX IF NOT EXISTS idx_quick_actions_user_id ON quick_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_actions_voice_trigger ON quick_actions(voice_trigger);

CREATE INDEX IF NOT EXISTS idx_usage_logs_conversation_id ON usage_logs(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_shown_dismissed ON ai_insights(shown_to_user, dismissed);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type);

-- ============================================
-- ADD TRIGGERS FOR NEW TABLES
-- ============================================
DROP TRIGGER IF EXISTS update_user_context_updated_at ON user_context;
CREATE TRIGGER update_user_context_updated_at 
    BEFORE UPDATE ON user_context 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_smart_reminders_updated_at ON smart_reminders;
CREATE TRIGGER update_smart_reminders_updated_at 
    BEFORE UPDATE ON smart_reminders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quick_actions_updated_at ON quick_actions;
CREATE TRIGGER update_quick_actions_updated_at 
    BEFORE UPDATE ON quick_actions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
CREATE TRIGGER update_integrations_updated_at 
    BEFORE UPDATE ON integrations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CREATE/REPLACE VIEWS
-- ============================================
DROP VIEW IF EXISTS user_usage_summary;
CREATE VIEW user_usage_summary AS
SELECT 
    user_id,
    DATE_TRUNC('month', created_at) as month,
    SUM(api_calls) as total_api_calls,
    SUM(voice_minutes) as total_voice_minutes,
    COUNT(DISTINCT tool_name) as unique_tools_used,
    AVG(response_time_ms) as avg_response_time_ms,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*)::FLOAT, 0) as success_rate
FROM usage_logs
GROUP BY user_id, DATE_TRUNC('month', created_at);

DROP VIEW IF EXISTS active_reminders;
CREATE VIEW active_reminders AS
SELECT 
    sr.*,
    up.timezone
FROM smart_reminders sr
JOIN user_preferences up ON sr.user_id = up.user_id
WHERE sr.status = 'pending'
AND sr.remind_at <= NOW() + INTERVAL '1 hour'
ORDER BY sr.remind_at ASC;

DROP VIEW IF EXISTS user_engagement;
CREATE VIEW user_engagement AS
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
-- VERIFY MIGRATION
-- ============================================
SELECT 'Migration complete! New tables:' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_context',
    'smart_reminders',
    'quick_actions',
    'ai_insights',
    'integrations'
)
ORDER BY table_name;
