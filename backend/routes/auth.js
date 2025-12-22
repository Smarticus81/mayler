import express from 'express';
import { supabase, isSupabaseConfigured } from '../supabase.js';

export const createAuthRouter = () => {
    const router = express.Router();

    // Health check
    router.get('/status', (req, res) => {
        res.json({
            configured: isSupabaseConfigured(),
            multiTenant: isSupabaseConfigured()
        });
    });

    // Sign up
    router.post('/signup', async (req, res) => {
        if (!isSupabaseConfigured()) {
            return res.status(503).json({
                error: 'Multi-tenant mode not configured',
                message: 'This instance is running in single-user mode'
            });
        }

        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Email and password are required'
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    error: 'Invalid password',
                    message: 'Password must be at least 8 characters'
                });
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                console.error('[Auth] Signup error:', error);
                return res.status(400).json({
                    error: error.message,
                    message: 'Failed to create account'
                });
            }

            // Create default user preferences
            if (data.user) {
                await supabase.from('user_preferences').insert({
                    user_id: data.user.id,
                    voice_engine: 'openai',
                    selected_voice: 'alloy',
                    wake_word_enabled: true
                });

                // Create default subscription (free tier)
                await supabase.from('subscriptions').insert({
                    user_id: data.user.id,
                    plan: 'free',
                    status: 'active'
                });
            }

            res.json({
                success: true,
                user: data.user,
                session: data.session,
                message: 'Account created successfully'
            });
        } catch (error) {
            console.error('[Auth] Signup error:', error);
            res.status(500).json({
                error: 'Signup failed',
                message: error.message
            });
        }
    });

    // Sign in
    router.post('/signin', async (req, res) => {
        if (!isSupabaseConfigured()) {
            return res.status(503).json({
                error: 'Multi-tenant mode not configured',
                message: 'This instance is running in single-user mode'
            });
        }

        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Email and password are required'
                });
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('[Auth] Signin error:', error);
                return res.status(401).json({
                    error: error.message,
                    message: 'Invalid email or password'
                });
            }

            res.json({
                success: true,
                user: data.user,
                session: data.session,
                message: 'Signed in successfully'
            });
        } catch (error) {
            console.error('[Auth] Signin error:', error);
            res.status(500).json({
                error: 'Signin failed',
                message: error.message
            });
        }
    });

    // Sign out
    router.post('/signout', async (req, res) => {
        if (!isSupabaseConfigured()) {
            return res.json({ success: true });
        }

        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.json({ success: true });
            }

            const token = authHeader.split(' ')[1];
            const { error } = await supabase.auth.admin.signOut(token);

            if (error) {
                console.error('[Auth] Signout error:', error);
            }

            res.json({ success: true, message: 'Signed out successfully' });
        } catch (error) {
            console.error('[Auth] Signout error:', error);
            res.status(500).json({
                error: 'Signout failed',
                message: error.message
            });
        }
    });

    // Get current user
    router.get('/me', async (req, res) => {
        if (!isSupabaseConfigured()) {
            return res.json({ user: null, multiTenant: false });
        }

        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.json({ user: null });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                return res.json({ user: null });
            }

            // Get user preferences and subscription
            const [prefsResult, subResult] = await Promise.all([
                supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
                supabase.from('subscriptions').select('*').eq('user_id', user.id).single()
            ]);

            res.json({
                user,
                preferences: prefsResult.data,
                subscription: subResult.data,
                multiTenant: true
            });
        } catch (error) {
            console.error('[Auth] Get user error:', error);
            res.status(500).json({
                error: 'Failed to get user',
                message: error.message
            });
        }
    });

    return router;
};
