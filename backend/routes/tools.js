import express from 'express';
import fetch from 'node-fetch';

/**
 * Centralized tool execution endpoint per the OpenAI Realtime Voice Pipeline spec.
 * Client receives tool calls on the data channel, POSTs here, server runs the tool,
 * returns the result, client sends it back to OpenAI via the data channel.
 */
export const createToolsRouter = (gmailService, utilityService, searchService) => {
    const router = express.Router();

    // Email ID validation registry (per-session)
    const sessionRegistries = new Map();

    function getRegistry(sessionId) {
        if (!sessionRegistries.has(sessionId)) {
            sessionRegistries.set(sessionId, { validIds: new Set(), lastFetchTime: 0 });
        }
        return sessionRegistries.get(sessionId);
    }

    async function executeTool(name, args, sessionId) {
        const registry = getRegistry(sessionId);

        switch (name) {
            // ── Google OAuth ──
            case 'google_auth_setup': {
                const authUrl = gmailService.getAuthUrl?.();
                if (authUrl) {
                    return { result: 'Opening Google authentication. Please complete the authorization process.', command: { type: 'oauth', authUrl } };
                }
                return { result: 'Google authentication is not available right now.' };
            }

            // ── Gmail Operations ──
            case 'check_gmail_connection': {
                const isConnected = !!gmailService.gmail;
                const authUrl = !isConnected ? await gmailService.getAuthUrl().catch(() => null) : null;
                return { result: JSON.stringify({ connected: isConnected, authUrl }) };
            }

            case 'get_emails': {
                const maxResults = Number(args.maxResults) || 5;
                const query = args.query || 'in:inbox';
                const pageToken = args.pageToken || '';
                const resp = await gmailService.getRecentEmails(maxResults, pageToken, query);
                // Register valid IDs
                registry.validIds.clear();
                registry.lastFetchTime = Date.now();
                if (resp && Array.isArray(resp.emails)) {
                    for (const email of resp.emails) {
                        if (email?.id) registry.validIds.add(email.id);
                    }
                }
                return { result: JSON.stringify(resp) };
            }

            case 'get_email_by_id': {
                const emailId = String(args.emailId || '');
                if (!emailId) {
                    return { result: 'No email ID provided. Call get_emails first to get valid IDs.' };
                }
                if (registry.validIds.size === 0 && registry.lastFetchTime === 0) {
                    return { result: 'You have not fetched any emails yet. Call get_emails first.' };
                }
                if (!registry.validIds.has(emailId)) {
                    return { result: `Email ID "${emailId}" was not returned by get_emails. Call get_emails again for the next batch.` };
                }
                const email = await gmailService.getEmailById(emailId);
                registry.validIds.delete(emailId);
                return { result: JSON.stringify(email) };
            }

            case 'search_emails': {
                const resp = await gmailService.searchEmails(String(args.query || ''), Number(args.maxResults) || 5);
                registry.validIds.clear();
                registry.lastFetchTime = Date.now();
                if (resp && Array.isArray(resp.emails)) {
                    for (const email of resp.emails) {
                        if (email?.id) registry.validIds.add(email.id);
                    }
                }
                return { result: JSON.stringify(resp) };
            }

            case 'create_draft': {
                const resp = await gmailService.createDraft({
                    to: args.to, subject: args.subject, text: args.text, cc: args.cc, bcc: args.bcc
                });
                return { result: `Draft created successfully. ${JSON.stringify(resp)}` };
            }

            case 'list_drafts': {
                const resp = await gmailService.listDrafts(Number(args.maxResults) || 10);
                return { result: JSON.stringify(resp) };
            }

            case 'send_draft': {
                const resp = await gmailService.sendDraft(String(args.draftId));
                return { result: `Draft sent. ${JSON.stringify(resp)}` };
            }

            case 'reply_to_email': {
                const emailId = String(args.emailId || '');
                if (!emailId) return { result: 'No email ID provided. Call get_emails first.' };
                const resp = await gmailService.replyToEmail(emailId, args.text);
                return { result: JSON.stringify(resp) };
            }

            case 'update_draft': {
                const resp = await gmailService.updateDraft(String(args.draftId), {
                    to: args.to, subject: args.subject, text: args.text, cc: args.cc, bcc: args.bcc
                });
                return { result: JSON.stringify(resp) };
            }

            case 'delete_draft': {
                const resp = await gmailService.deleteDraft(String(args.draftId));
                return { result: JSON.stringify(resp) };
            }

            case 'delete_email':
            case 'mark_email_read':
            case 'mark_email_unread':
            case 'star_email':
            case 'unstar_email':
            case 'archive_email':
            case 'mark_email_important':
            case 'mark_email_spam': {
                const emailId = String(args.emailId || '');
                if (!emailId) return { result: 'No email ID provided. Call get_emails first.' };
                const methodMap = {
                    delete_email: 'deleteEmail',
                    mark_email_read: 'markAsRead',
                    mark_email_unread: 'markAsUnread',
                    star_email: 'starEmail',
                    unstar_email: 'unstarEmail',
                    archive_email: 'archiveEmail',
                    mark_email_important: 'markAsImportant',
                    mark_email_spam: 'markAsSpam',
                };
                const method = methodMap[name];
                if (gmailService[method]) {
                    const resp = await gmailService[method](emailId);
                    return { result: JSON.stringify(resp) };
                }
                return { result: `Operation ${name} not available.` };
            }

            case 'forward_email': {
                const resp = await gmailService.forwardEmail(String(args.emailId), String(args.to), args.text);
                return { result: JSON.stringify(resp) };
            }

            case 'summarize_emails': {
                const resp = await gmailService.summarizeEmails(Number(args.maxResults) || 10);
                return { result: JSON.stringify(resp) };
            }

            // ── Calendar Operations ──
            case 'create_calendar_event': {
                const resp = await gmailService.createCalendarEvent(args);
                return { result: `Calendar event created. ${JSON.stringify(resp)}` };
            }

            case 'list_calendar_events': {
                const resp = await gmailService.listCalendarEvents(args);
                return { result: JSON.stringify(resp) };
            }

            case 'update_calendar_event': {
                const resp = await gmailService.updateCalendarEvent(args);
                return { result: JSON.stringify(resp) };
            }

            case 'delete_calendar_event': {
                const resp = await gmailService.deleteCalendarEvent(String(args.eventId));
                return { result: JSON.stringify(resp) };
            }

            // ── Web Search & Browsing ──
            case 'web_search': {
                const resp = await searchService.search(String(args.query), Number(args.maxResults) || 5);
                return { result: JSON.stringify(resp) };
            }

            case 'deep_search': {
                const resp = await searchService.deepSearch({
                    query: String(args.query),
                    maxResults: Number(args.maxResults) || 8,
                    includeNews: args.includeNews !== false,
                    includeFacts: args.includeFacts !== false,
                });
                return { result: JSON.stringify(resp) };
            }

            case 'deep_research': {
                const resp = await searchService.deepResearch({
                    query: String(args.query),
                    maxResults: Number(args.maxResults) || 5,
                });
                return { result: JSON.stringify(resp) };
            }

            // ── Utilities ──
            case 'get_weather': {
                const resp = await utilityService.getWeather(String(args.location), args.units);
                return { result: JSON.stringify(resp) };
            }

            case 'calculate': {
                const resp = await utilityService.calculate(String(args.expression));
                return { result: JSON.stringify(resp) };
            }

            case 'convert_units': {
                const resp = await utilityService.convertUnits(args.value, String(args.from), String(args.to));
                return { result: JSON.stringify(resp) };
            }

            case 'get_time': {
                const resp = await utilityService.getTime(args.timezone);
                return { result: JSON.stringify(resp) };
            }

            case 'get_definition': {
                const resp = await utilityService.getDefinition(String(args.word));
                return { result: JSON.stringify(resp) };
            }

            case 'get_stock_price': {
                const resp = await utilityService.getStockPrice(String(args.symbol));
                return { result: JSON.stringify(resp) };
            }

            case 'get_crypto_price': {
                const resp = await utilityService.getCryptoPrice(String(args.symbol), args.currency);
                return { result: JSON.stringify(resp) };
            }

            case 'get_news': {
                const resp = await searchService.getNews(String(args.topic), Number(args.maxResults) || 5);
                return { result: JSON.stringify(resp) };
            }

            case 'get_factual_info': {
                const resp = await searchService.getFactualInfo(String(args.query));
                return { result: JSON.stringify(resp) };
            }

            case 'wikipedia_search': {
                const resp = await searchService.wikipediaSearch(String(args.query));
                return { result: JSON.stringify(resp) };
            }

            // ── Session Control ──
            case 'disconnect_session': {
                // Clean up session registry
                sessionRegistries.delete(sessionId);
                return { result: 'Session disconnected.', command: { type: 'disconnect' } };
            }

            default:
                return { result: `Unknown tool: ${name}` };
        }
    }

    router.post('/', async (req, res) => {
        const { tool_name, arguments: args = {}, session_id } = req.body ?? {};

        if (!tool_name) {
            res.status(400).json({ error: 'tool_name is required' });
            return;
        }

        try {
            const { result, command } = await executeTool(tool_name, args, session_id || 'default');
            res.json({ result, command: command ?? null });
        } catch (e) {
            console.error(`Tool error (${tool_name}):`, e.message);
            res.status(500).json({ result: `Error executing ${tool_name}: ${e.message}`, command: null });
        }
    });

    return router;
};
