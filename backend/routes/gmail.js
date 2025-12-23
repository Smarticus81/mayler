import express from 'express';

export const createGmailRouter = (gmailService) => {
    const router = express.Router();

    // Helper to ensure auth
    const ensureAuth = async (req, res, next) => {
        if (!gmailService.gmail) {
            // Try to re-init
            const available = await gmailService.initialize();
            if (available && gmailService.gmail) {
                return next();
            }
            return res.status(503).json({ error: 'Gmail not authenticated' });
        }
        next();
    };

    router.get('/auth-url', async (req, res) => {
        try {
            const authUrl = await gmailService.getAuthUrl();
            res.json({ authUrl });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/auth-redirect', async (req, res) => {
        try {
            const { code } = req.query;
            if (!code) {
                return res.status(400).send('<html><body><h2>Authentication Failed</h2><p>No code received.</p></body></html>');
            }

            await gmailService.setAuthCode(code);

            res.send(`
                <html>
                    <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                            body { font-family: sans-serif; background: #0a0a0f; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }
                            h2 { color: #6ee7b7; }
                        </style>
                    </head>
                    <body>
                        <div>
                            <h2>Google Connected</h2>
                            <p>Returning to Mayler...</p>
                        </div>
                        <script>
                            setTimeout(() => {
                                if (window.opener) window.close();
                                else window.location.href = '/?auth_success=true';
                            }, 1000);
                        </script>
                    </body>
                </html>
            `);
        } catch (error) {
            res.status(500).send(`<html><body><h2>Error</h2><p>${error.message}</p></body></html>`);
        }
    });

    router.post('/auth', async (req, res) => {
        try {
            const { code } = req.body;
            if (!code) return res.status(400).json({ error: 'Code required' });
            await gmailService.setAuthCode(code);
            res.json({ success: true, message: 'Authenticated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/emails', ensureAuth, async (req, res) => {
        try {
            const maxResults = parseInt(req.query.maxResults) || 10;
            const emails = await gmailService.getRecentEmails(maxResults);
            res.json({ emails });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/summarize', ensureAuth, async (req, res) => {
        try {
            const maxResults = parseInt(req.body.maxResults) || 10;
            const result = await gmailService.summarizeEmails(maxResults);
            res.json({ result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/search', ensureAuth, async (req, res) => {
        try {
            const { query, maxResults = 5 } = req.body;
            if (!query) return res.status(400).json({ error: 'Query required' });
            const emails = await gmailService.searchEmails(query, maxResults);
            res.json({ emails });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/send', ensureAuth, async (req, res) => {
        try {
            const { to, subject, text, cc, bcc } = req.body;
            const result = await gmailService.sendEmail({ to, subject, text, cc, bcc });
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/email/:id', ensureAuth, async (req, res) => {
        try {
            const email = await gmailService.getEmailById(req.params.id);
            res.json({ email });
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.delete('/email/:id', ensureAuth, async (req, res) => {
        try {
            const { permanent = false } = req.query;
            const result = await gmailService.deleteEmail(req.params.id, permanent === 'true');
            res.json({ success: true, result });
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.post('/delete', ensureAuth, async (req, res) => {
        try {
            const { emailId, permanent = false } = req.body;
            if (!emailId) return res.status(400).json({ error: 'Email ID required' });
            const result = await gmailService.deleteEmail(emailId, permanent);
            res.json({ success: true, result });
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.post('/mark-read', ensureAuth, async (req, res) => {
        try {
            const { emailId } = req.body;
            console.log('[Gmail Route] Marking email as read:', emailId);
            const result = await gmailService.markAsRead(emailId);
            res.json({ success: true, result });
        } catch (error) {
            console.error('[Gmail Route] Mark read failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/mark-unread', ensureAuth, async (req, res) => {
        try {
            const { emailId } = req.body;
            console.log('[Gmail Route] Marking email as unread:', emailId);
            const result = await gmailService.markAsUnread(emailId);
            res.json({ success: true, result });
        } catch (error) {
            console.error('[Gmail Route] Mark unread failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/star', ensureAuth, async (req, res) => {
        try {
            const { emailId } = req.body;
            const result = await gmailService.starEmail(emailId);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/archive', ensureAuth, async (req, res) => {
        try {
            const { emailId } = req.body;
            const result = await gmailService.archiveEmail(emailId);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/reply/:id', ensureAuth, async (req, res) => {
        try {
            const { text, html } = req.body;
            const result = await gmailService.replyToEmail(req.params.id, text, html);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/summarize', ensureAuth, async (req, res) => {
        try {
            const { maxResults = 10 } = req.body;
            console.log('[Gmail Route] Summarizing recent emails');
            const emails = await gmailService.getRecentEmails(maxResults);

            // Note: summarizeEmails is implemented in GmailService
            const summary = await gmailService.summarizeEmails(emails);
            res.json({ summary, emails: emails.slice(0, 5) });
        } catch (error) {
            console.error('[Gmail Route] Summarize failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
