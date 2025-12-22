-- Mayler Multi-Tenant Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- USER PREFERENCES
-- ============================================
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

-- ============================================
-- GMAIL TOKENS (Per User)
-- ============================================
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

-- ============================================
-- CONVERSATION HISTORY
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- USAGE TRACKING
-- ============================================
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_name VARCHAR,
    api_calls INTEGER DEFAULT 1,
    voice_minutes DECIMAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS & BILLING
-- ============================================
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

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - USER PREFERENCES
-- ============================================
CREATE POLICY "Users can view own preferences" 
ON user_preferences
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
ON user_preferences
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
ON user_preferences
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - GMAIL TOKENS
-- ============================================
CREATE POLICY "Users can view own gmail tokens" 
ON user_gmail_tokens
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail tokens" 
ON user_gmail_tokens
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail tokens" 
ON user_gmail_tokens
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - CONVERSATIONS
-- ============================================
CREATE POLICY "Users can view own conversations" 
ON conversations
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" 
ON conversations
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" 
ON conversations
FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES - USAGE LOGS
-- ============================================
CREATE POLICY "Users can view own usage" 
ON usage_logs
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs" 
ON usage_logs
FOR INSERT 
WITH CHECK (true);

-- ============================================
-- RLS POLICIES - SUBSCRIPTIONS
-- ============================================
CREATE POLICY "Users can view own subscription" 
ON subscriptions
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage subscriptions" 
ON subscriptions
FOR ALL 
USING (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_gmail_tokens_user_id ON user_gmail_tokens(user_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

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

-- Trigger for user_preferences
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_gmail_tokens
CREATE TRIGGER update_user_gmail_tokens_updated_at
    BEFORE UPDATE ON user_gmail_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for subscriptions
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR ANALYTICS (Optional)
-- ============================================

-- User usage summary view
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT 
    user_id,
    DATE_TRUNC('month', created_at) as month,
    SUM(api_calls) as total_api_calls,
    SUM(voice_minutes) as total_voice_minutes,
    COUNT(DISTINCT tool_name) as unique_tools_used
FROM usage_logs
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Note: In production, users are created via the signup endpoint
-- This is just for reference/testing

-- Example: Insert default preferences for a user
-- INSERT INTO user_preferences (user_id, voice_engine, selected_voice)
-- VALUES ('user-uuid-here', 'openai', 'alloy');

-- ============================================
-- SCHEMA COMPLETE
-- ============================================

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_preferences',
    'user_gmail_tokens',
    'conversations',
    'usage_logs',
    'subscriptions'
);
