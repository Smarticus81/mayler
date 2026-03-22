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

    router.get('/auth-status', async (req, res) => {
        try {
            const isConnected = !!gmailService.gmail;
            const authUrl = !isConnected ? await gmailService.getAuthUrl().catch(() => null) : null;
            res.json({ connected: isConnected, authUrl });
        } catch (error) {
            res.json({ connected: false, error: error.message });
        }
    });

    router.get('/emails', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📧 [Gmail API] GET /emails - Fetching emails from Gmail');
        console.log(`📋 Parameters: maxResults=${req.query.maxResults || 10}, pageToken=${req.query.pageToken || 'none'}`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const maxResults = parseInt(req.query.maxResults) || 10;
            const pageToken = req.query.pageToken || null;
            const query = req.query.query || 'in:inbox';
            const result = await gmailService.getRecentEmails(maxResults, pageToken, query);
            const emails = result.emails || result;
            const nextPageToken = result.nextPageToken || null;
            console.log(`✅ [Gmail API] Successfully fetched ${emails?.length || 0} emails`);
            if (emails?.length > 0) {
                console.log('📬 Email subjects:');
                emails.slice(0, 5).forEach((e, i) => console.log(`   ${i + 1}. ${e.subject || '(no subject)'}`));
            }
            if (nextPageToken) console.log(`📄 Next page token: ${nextPageToken.substring(0, 20)}...`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ emails, nextPageToken });
        } catch (error) {
            console.error('❌ [Gmail API] Failed to fetch emails:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/summarize', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📝 [Gmail API] POST /summarize - Summarizing emails');
        console.log(`📋 Parameters: maxResults=${req.body.maxResults || 10}`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const maxResults = parseInt(req.body.maxResults) || 10;
            const result = await gmailService.summarizeEmails(maxResults);
            console.log('✅ [Gmail API] Email summary generated successfully');
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ result });
        } catch (error) {
            console.error('❌ [Gmail API] Summarize failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/search', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🔍 [Gmail API] POST /search - Searching emails');
        console.log(`📋 Query: "${req.body.query}", maxResults=${req.body.maxResults || 5}`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const { query, maxResults = 5 } = req.body;
            if (!query) {
                console.log('⚠️ [Gmail API] Search aborted - no query provided');
                return res.status(400).json({ error: 'Query required' });
            }
            const emails = await gmailService.searchEmails(query, maxResults);
            console.log(`✅ [Gmail API] Search returned ${emails?.length || 0} results`);
            if (emails?.length > 0) {
                console.log('📬 Search results:');
                emails.slice(0, 5).forEach((e, i) => console.log(`   ${i + 1}. ${e.subject || '(no subject)'}`));
            }
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ emails });
        } catch (error) {
            console.error('❌ [Gmail API] Search failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/send', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📤 [Gmail API] POST /send - Sending email');
        console.log(`📋 To: ${req.body.to}, Subject: "${req.body.subject}"`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const { to, subject, text, cc, bcc } = req.body;
            const result = await gmailService.sendEmail({ to, subject, text, cc, bcc });
            console.log('✅ [Gmail API] Email sent successfully');
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ success: true, result });
        } catch (error) {
            console.error('❌ [Gmail API] Send failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/email/:id', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📖 [Gmail API] GET /email/:id - Fetching full email content');
        console.log(`📋 Email ID: ${req.params.id}`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const email = await gmailService.getEmailById(req.params.id);
            console.log(`✅ [Gmail API] Successfully fetched email: "${email.subject || '(no subject)'}"`);
            console.log(`📧 From: ${email.from || 'unknown'}`);
            console.log(`📝 Body length: ${email.body?.length || 0} characters`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ email });
        } catch (error) {
            console.error('❌ [Gmail API] Get email by ID failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
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

    router.post('/unstar', ensureAuth, async (req, res) => {
        try {
            const { emailId } = req.body;
            const result = await gmailService.unstarEmail(emailId);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/mark-important', ensureAuth, async (req, res) => {
        try {
            const { emailId } = req.body;
            const result = await gmailService.markAsImportant(emailId);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/mark-spam', ensureAuth, async (req, res) => {
        try {
            const { emailId } = req.body;
            const result = await gmailService.markAsSpam(emailId);
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

    // Draft Operations
    router.post('/drafts', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📝 [Gmail API] POST /drafts - Creating draft');
        console.log(`📋 To: ${req.body.to}, Subject: "${req.body.subject}"`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const { to, subject, text, cc, bcc } = req.body;
            const draft = await gmailService.createDraft({ to, subject, text, cc, bcc });
            console.log(`✅ [Gmail API] Draft created with ID: ${draft.id}`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ success: true, draft });
        } catch (error) {
            console.error('❌ [Gmail API] Create draft failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/drafts', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📋 [Gmail API] GET /drafts - Listing drafts');
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const maxResults = parseInt(req.query.maxResults) || 10;
            const drafts = await gmailService.listDrafts(maxResults);
            console.log(`✅ [Gmail API] Found ${drafts.length} drafts`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ drafts });
        } catch (error) {
            console.error('❌ [Gmail API] List drafts failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/drafts/:id', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`📝 [Gmail API] PUT /drafts/${req.params.id} - Updating draft`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const { to, subject, text, cc, bcc } = req.body;
            const draft = await gmailService.updateDraft(req.params.id, { to, subject, text, cc, bcc });
            console.log(`✅ [Gmail API] Draft updated`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ success: true, draft });
        } catch (error) {
            console.error('❌ [Gmail API] Update draft failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/drafts/:id/send', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`📤 [Gmail API] POST /drafts/${req.params.id}/send - Sending draft`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const result = await gmailService.sendDraft(req.params.id);
            console.log(`✅ [Gmail API] Draft sent successfully`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ success: true, result });
        } catch (error) {
            console.error('❌ [Gmail API] Send draft failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/drafts/:id', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`🗑️ [Gmail API] DELETE /drafts/${req.params.id} - Deleting draft`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const result = await gmailService.deleteDraft(req.params.id);
            console.log(`✅ [Gmail API] Draft deleted`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ success: true, result });
        } catch (error) {
            console.error('❌ [Gmail API] Delete draft failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/forward/:id', ensureAuth, async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`↪️ [Gmail API] POST /forward/${req.params.id} - Forwarding email`);
        console.log(`📋 To: ${req.body.to}`);
        console.log('═══════════════════════════════════════════════════════════════');
        try {
            const { to, text } = req.body;
            const result = await gmailService.forwardEmail(req.params.id, to, text);
            console.log(`✅ [Gmail API] Email forwarded successfully`);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.json({ success: true, result });
        } catch (error) {
            console.error('❌ [Gmail API] Forward email failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
