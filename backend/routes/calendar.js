import express from 'express';

export const createCalendarRouter = (gmailService) => {
    const router = express.Router();

    const ensureAuth = async (req, res, next) => {
        const available = await gmailService.initialize();
        if (!available) {
            return res.status(503).json({ error: 'Google not authenticated' });
        }
        next();
    };

    router.post('/events', ensureAuth, async (req, res) => {
        try {
            const { summary, description, start, end, timezone, attendees, location, reminders } = req.body;
            const result = await gmailService.createCalendarEvent({
                summary, description, start, end, timezone, attendees, location, reminders
            });
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/events', ensureAuth, async (req, res) => {
        try {
            const { timeMin, timeMax, maxResults = 10, query } = req.query;
            const events = await gmailService.listCalendarEvents({
                timeMin, timeMax, maxResults: parseInt(maxResults), query
            });
            res.json({ events });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/action-item', ensureAuth, async (req, res) => {
        try {
            const { actionItem, dueDate, priority = 'medium' } = req.body;
            const result = await gmailService.addActionItemToCalendar(actionItem, dueDate, priority);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/events/:id', ensureAuth, async (req, res) => {
        try {
            const result = await gmailService.updateCalendarEvent(req.params.id, req.body);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/update', ensureAuth, async (req, res) => {
        try {
            const { eventId, ...updates } = req.body;
            if (!eventId) return res.status(400).json({ error: 'Event ID required' });
            const result = await gmailService.updateCalendarEvent(eventId, updates);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/events/:id', ensureAuth, async (req, res) => {
        try {
            const result = await gmailService.deleteCalendarEvent(req.params.id);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/delete', ensureAuth, async (req, res) => {
        try {
            const { eventId } = req.body;
            if (!eventId) return res.status(400).json({ error: 'Event ID required' });
            const result = await gmailService.deleteCalendarEvent(eventId);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
