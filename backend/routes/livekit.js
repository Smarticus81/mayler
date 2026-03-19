import express from 'express';
import crypto from 'crypto';

export const createLiveKitRouter = (livekitService) => {
    const router = express.Router();

    /**
     * POST /api/livekit/token
     * Generate an access token for a user to join a LiveKit room
     * with automatic Mayler agent dispatch.
     *
     * Body: { identity?, roomName?, agentName? }
     */
    router.post('/token', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🎙️ [LiveKit] Generating access token');
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            if (!livekitService.isConfigured()) {
                return res.status(503).json({
                    error: 'LiveKit not configured',
                    message: 'Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL in your environment.',
                });
            }

            const identity = req.body.identity || `user-${crypto.randomBytes(4).toString('hex')}`;
            const roomName = req.body.roomName || `mayler-${crypto.randomBytes(6).toString('hex')}`;
            const agentName = req.body.agentName || 'mayler-voice-agent';

            const token = await livekitService.createTokenWithAgentDispatch(
                identity,
                roomName,
                { agentName }
            );

            console.log(`✅ [LiveKit] Token generated for ${identity} in room ${roomName}`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.json({
                token,
                identity,
                roomName,
                wsUrl: livekitService.wsUrl,
            });
        } catch (error) {
            console.error('❌ [LiveKit] Token generation failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/livekit/status
     * Check if LiveKit is configured and available.
     */
    router.get('/status', (_req, res) => {
        res.json({
            configured: livekitService.isConfigured(),
            url: livekitService.isConfigured() ? livekitService.wsUrl : null,
        });
    });

    /**
     * GET /api/livekit/rooms
     * List active LiveKit rooms (admin/debug).
     */
    router.get('/rooms', async (_req, res) => {
        try {
            const rooms = await livekitService.listRooms();
            res.json({ rooms });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
