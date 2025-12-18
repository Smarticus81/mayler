import { useCallback } from 'react';
import { asObject, safeJson } from '../utils/jsonUtils';

export const useToolkit = () => {
    const runTool = useCallback(async (name: string, args: unknown) => {
        const a = asObject(args) ?? {};

        switch (name) {
            case 'google_auth_setup': {
                const resp = await fetch('/api/gmail/auth-url');
                const data = await safeJson(resp);

                if (resp.ok && data.authUrl) {
                    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true;

                    if (isStandalone) {
                        window.location.href = data.authUrl;
                        return { success: true, message: 'Redirecting to Google authentication...' };
                    }

                    const width = 600;
                    const height = 700;
                    const left = window.screenX + (window.outerWidth - width) / 2;
                    const top = window.screenY + (window.outerHeight - height) / 2;

                    window.open(
                        data.authUrl,
                        'Google Authentication',
                        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
                    );

                    return {
                        success: true,
                        message: 'Opening Google authentication window. Please complete the authorization process.'
                    };
                }
                return data;
            }
            case 'create_calendar_event': {
                const resp = await fetch('/api/calendar/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(a),
                });
                return await safeJson(resp);
            }
            case 'list_calendar_events': {
                const params = new URLSearchParams();
                if (a.timeMin) params.set('timeMin', String(a.timeMin));
                if (a.timeMax) params.set('timeMax', String(a.timeMax));
                if (a.maxResults != null) params.set('maxResults', String(a.maxResults));
                if (a.query) params.set('query', String(a.query));
                const resp = await fetch(`/api/calendar/events?${params.toString()}`);
                return await safeJson(resp);
            }
            case 'get_emails': {
                const maxResults = (a.maxResults as number | undefined) ?? 5;
                const resp = await fetch(`/api/gmail/emails?maxResults=${encodeURIComponent(String(maxResults))}`);
                return await safeJson(resp);
            }
            case 'search_emails': {
                const resp = await fetch('/api/gmail/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: a.query, maxResults: (a.maxResults as number | undefined) ?? 5 }),
                });
                return await safeJson(resp);
            }
            case 'send_email': {
                const resp = await fetch('/api/gmail/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(a),
                });
                return await safeJson(resp);
            }
            case 'web_search': {
                const resp = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: a.query, maxResults: (a.maxResults as number | undefined) ?? 5 }),
                });
                return await safeJson(resp);
            }
            case 'get_weather': {
                const resp = await fetch('/api/weather', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location: a.location, units: a.units }),
                });
                return await safeJson(resp);
            }
            case 'calculate': {
                const resp = await fetch('/api/calculate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ expression: a.expression }),
                });
                return await safeJson(resp);
            }
            case 'get_stock_price': {
                const resp = await fetch('/api/stock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: a.symbol }),
                });
                return await safeJson(resp);
            }
            case 'get_crypto_price': {
                const resp = await fetch('/api/crypto', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: a.symbol, currency: a.currency }),
                });
                return await safeJson(resp);
            }
            case 'get_definition': {
                const resp = await fetch('/api/definition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ word: a.word }),
                });
                return await safeJson(resp);
            }
            case 'wikipedia_search': {
                const resp = await fetch('/api/wikipedia', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: a.query }),
                });
                return await safeJson(resp);
            }
            case 'convert_units': {
                const resp = await fetch('/api/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: a.value, from: a.from, to: a.to }),
                });
                return await safeJson(resp);
            }
            case 'get_time': {
                const resp = await fetch('/api/time', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timezone: a.timezone }),
                });
                return await safeJson(resp);
            }
            case 'set_reminder': {
                const resp = await fetch('/api/calendar/action-item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        actionItem: a.title,
                        dueDate: a.dateTime,
                        priority: a.priority ?? 'medium',
                    }),
                });
                return await safeJson(resp);
            }
            case 'delete_email': {
                const resp = await fetch('/api/gmail/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emailId: a.emailId }),
                });
                return await safeJson(resp);
            }
            case 'mark_email_read': {
                const resp = await fetch('/api/gmail/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emailId: a.emailId }),
                });
                return await safeJson(resp);
            }
            case 'mark_email_unread': {
                const resp = await fetch('/api/gmail/mark-unread', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emailId: a.emailId }),
                });
                return await safeJson(resp);
            }
            case 'star_email': {
                const resp = await fetch('/api/gmail/star', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emailId: a.emailId }),
                });
                return await safeJson(resp);
            }
            case 'archive_email': {
                const resp = await fetch('/api/gmail/archive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emailId: a.emailId }),
                });
                return await safeJson(resp);
            }
            case 'update_calendar_event': {
                const resp = await fetch('/api/calendar/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(a),
                });
                return await safeJson(resp);
            }
            case 'delete_calendar_event': {
                const resp = await fetch('/api/calendar/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: a.eventId }),
                });
                return await safeJson(resp);
            }
            case 'get_news': {
                const resp = await fetch('/api/news', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category: a.category, country: a.country }),
                });
                return await safeJson(resp);
            }
            case 'convert_currency': {
                const resp = await fetch('/api/currency', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: a.amount, from: a.from, to: a.to }),
                });
                return await safeJson(resp);
            }
            case 'translate_text': {
                const resp = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: a.text, targetLanguage: a.targetLang, sourceLanguage: a.sourceLang }),
                });
                return await safeJson(resp);
            }
            case 'set_timer': {
                const resp = await fetch('/api/timer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duration: a.duration, label: a.label }),
                });
                return await safeJson(resp);
            }
            case 'create_note': {
                const resp = await fetch('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: a.title, content: a.content }),
                });
                return await safeJson(resp);
            }
            case 'reply_to_email': {
                const resp = await fetch(`/api/gmail/reply/${a.emailId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: a.text, html: a.html }),
                });
                return await safeJson(resp);
            }
            case 'get_email_by_id': {
                const resp = await fetch(`/api/gmail/email/${a.emailId}`);
                return await safeJson(resp);
            }
            case 'summarize_emails': {
                const resp = await fetch('/api/gmail/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ maxResults: (a.maxResults as number | undefined) ?? 10 }),
                });
                return await safeJson(resp);
            }
            case 'search_images': {
                const resp = await fetch('/api/search/images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: a.query, maxResults: (a.maxResults as number | undefined) ?? 5 }),
                });
                return await safeJson(resp);
            }
            case 'search_videos': {
                const resp = await fetch('/api/search/videos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: a.query, maxResults: (a.maxResults as number | undefined) ?? 5 }),
                });
                return await safeJson(resp);
            }
            case 'get_factual_info': {
                const resp = await fetch('/api/search/facts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: a.query }),
                });
                return await safeJson(resp);
            }
            default:
                return { error: `Unknown tool: ${name}` };
        }
    }, []);

    const toolkitDefinitions = [
        // Google OAuth
        { type: 'function', name: 'google_auth_setup', description: 'Opens an OAuth window for the user to authenticate with Google, granting access to Gmail and Calendar. Call this when the user wants to connect their Google account. The window will open automatically.', parameters: { type: 'object', properties: {} } },

        // Gmail CRUD Operations
        { type: 'function', name: 'get_emails', description: "Retrieves recent emails from the user's Gmail inbox.", parameters: { type: 'object', properties: { maxResults: { type: 'number' } } } },
        { type: 'function', name: 'search_emails', description: 'Searches emails in Gmail with a query.', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
        { type: 'function', name: 'send_email', description: 'Sends a new email via Gmail.', parameters: { type: 'object', properties: { to: { type: 'string', description: 'Recipient email address' }, subject: { type: 'string', description: 'Email subject' }, text: { type: 'string', description: 'Email body text' }, cc: { type: 'string' }, bcc: { type: 'string' } }, required: ['to', 'subject', 'text'] } },
        { type: 'function', name: 'reply_to_email', description: 'Replies to an existing email by its ID.', parameters: { type: 'object', properties: { emailId: { type: 'string' }, text: { type: 'string', description: 'Reply body text' } }, required: ['emailId', 'text'] } },
        { type: 'function', name: 'get_email_by_id', description: 'Retrieves a specific email by its unique ID.', parameters: { type: 'object', properties: { emailId: { type: 'string' } }, required: ['emailId'] } },
        { type: 'function', name: 'summarize_emails', description: 'Summarizes recent emails from the inbox.', parameters: { type: 'object', properties: { maxResults: { type: 'number' } } } },
        { type: 'function', name: 'delete_email', description: 'Deletes or trashes an email in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string' } }, required: ['emailId'] } },
        { type: 'function', name: 'mark_email_read', description: 'Marks an email as read in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string' } }, required: ['emailId'] } },
        { type: 'function', name: 'mark_email_unread', description: 'Marks an email as unread in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string' } }, required: ['emailId'] } },
        { type: 'function', name: 'star_email', description: 'Stars an email in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string' } }, required: ['emailId'] } },
        { type: 'function', name: 'archive_email', description: 'Archives an email (removes from Inbox) in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string' } }, required: ['emailId'] } },

        // Calendar Operations
        { type: 'function', name: 'create_calendar_event', description: "Creates a new event in the user's Google Calendar.", parameters: { type: 'object', properties: { summary: { type: 'string', description: 'Title of the event' }, description: { type: 'string', description: 'Description or details of the event' }, start: { type: 'string', description: 'Start time in ISO 8601 format' }, end: { type: 'string', description: 'End time in ISO 8601 format' }, location: { type: 'string', description: 'Location of the event' }, attendees: { type: 'array', items: { type: 'string' }, description: 'List of email addresses to invite' } }, required: ['summary', 'start', 'end'] } },
        { type: 'function', name: 'list_calendar_events', description: "Lists upcoming events from the user's primary calendar.", parameters: { type: 'object', properties: { timeMin: { type: 'string', description: 'ISO start time (defaults to now)' }, timeMax: { type: 'string', description: 'ISO end time' }, maxResults: { type: 'number' }, query: { type: 'string', description: 'Search term for events' } } } },
        { type: 'function', name: 'update_calendar_event', description: 'Updates an existing calendar event.', parameters: { type: 'object', properties: { eventId: { type: 'string' }, summary: { type: 'string' }, description: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, location: { type: 'string' } }, required: ['eventId'] } },
        { type: 'function', name: 'delete_calendar_event', description: 'Deletes an event from Google Calendar.', parameters: { type: 'object', properties: { eventId: { type: 'string' } }, required: ['eventId'] } },

        // Web & Information
        { type: 'function', name: 'web_search', description: 'Search the web for any information, news, or results.', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
        { type: 'function', name: 'get_factual_info', description: 'Retrieves factual information about a topic from Wikipedia or factual sources.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'The topic or question to look up' } }, required: ['query'] } },
        { type: 'function', name: 'search_images', description: 'Searches for images on the web.', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
        { type: 'function', name: 'search_videos', description: 'Searches for videos on YouTube or the web.', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
        { type: 'function', name: 'wikipedia_search', description: 'Search and retrieve summaries from Wikipedia.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
        { type: 'function', name: 'get_news', description: 'Retrieves latest news articles on a specific topic.', parameters: { type: 'object', properties: { topic: { type: 'string' }, maxResults: { type: 'number' } }, required: ['topic'] } },

        // Utilities & Productivity
        { type: 'function', name: 'get_weather', description: 'Retrieves current weather for a location.', parameters: { type: 'object', properties: { location: { type: 'string' }, units: { type: 'string', enum: ['metric', 'imperial'] } }, required: ['location'] } },
        { type: 'function', name: 'calculate', description: 'Performs mathematical calculations.', parameters: { type: 'object', properties: { expression: { type: 'string', description: 'Math expression to evaluate' } }, required: ['expression'] } },
        { type: 'function', name: 'convert_units', description: 'Converts between different units (length, weight, temp, etc).', parameters: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] } },
        { type: 'function', name: 'convert_currency', description: 'Converts an amount from one currency to another.', parameters: { type: 'object', properties: { amount: { type: 'number' }, from: { type: 'string', description: 'Source currency code (e.g. USD)' }, to: { type: 'string', description: 'Target currency code (e.g. EUR)' } }, required: ['amount', 'from', 'to'] } },
        { type: 'function', name: 'get_time', description: 'Gets the current time, optionally in a specific timezone.', parameters: { type: 'object', properties: { timezone: { type: 'string' } } } },
        { type: 'function', name: 'translate_text', description: 'Translates text to a target language.', parameters: { type: 'object', properties: { text: { type: 'string' }, targetLang: { type: 'string' }, sourceLang: { type: 'string' } }, required: ['text', 'targetLang'] } },
        { type: 'function', name: 'get_definition', description: 'Gets the dictionary definition of a word.', parameters: { type: 'object', properties: { word: { type: 'string' } }, required: ['word'] } },
        { type: 'function', name: 'set_timer', description: 'Sets a countdown timer.', parameters: { type: 'object', properties: { duration: { type: 'string', description: 'Duration (e.g., 5m, 1h)' }, label: { type: 'string' } }, required: ['duration'] } },
        { type: 'function', name: 'create_note', description: 'Creates a digital note or memo.', parameters: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['content'] } },
        { type: 'function', name: 'set_reminder', description: 'Creates a high-priority action item or reminder in the calendar.', parameters: { type: 'object', properties: { title: { type: 'string' }, dateTime: { type: 'string', description: 'ISO time' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['title', 'dateTime'] } },

        // Financial
        { type: 'function', name: 'get_stock_price', description: 'Gets current stock price for a symbol.', parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
        { type: 'function', name: 'get_crypto_price', description: 'Gets current cryptocurrency price.', parameters: { type: 'object', properties: { symbol: { type: 'string' }, currency: { type: 'string' } }, required: ['symbol'] } },
    ];

    return {
        runTool,
        toolkitDefinitions,
    };
};
