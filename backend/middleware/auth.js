import { supabase, isSupabaseConfigured } from '../supabase.js';

/**
 * Middleware to authenticate users via Supabase JWT tokens
 * Adds req.user object with user data if authenticated
 */
export const authenticateUser = async (req, res, next) => {
    // Skip auth if Supabase is not configured (single-user mode)
    if (!isSupabaseConfigured()) {
        console.log('[Auth] Supabase not configured, skipping authentication');
        req.user = null;
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Not authenticated',
            message: 'Please log in to access this resource'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Your session has expired. Please log in again.'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('[Auth] Error verifying token:', error);
        res.status(500).json({
            error: 'Authentication error',
            message: 'Failed to verify authentication'
        });
    }
};

/**
 * Optional auth middleware - allows both authenticated and anonymous access
 * Sets req.user if authenticated, null otherwise
 */
export const optionalAuth = async (req, res, next) => {
    if (!isSupabaseConfigured()) {
        req.user = null;
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user } } = await supabase.auth.getUser(token);
        req.user = user || null;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};
