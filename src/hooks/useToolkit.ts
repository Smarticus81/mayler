import { useCallback, useRef } from 'react';
import { asObject, safeJson } from '../utils/jsonUtils';

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ EMAIL ID VALIDATION REGISTRY
// Tracks valid email IDs returned by get_emails to prevent hallucination
// ═══════════════════════════════════════════════════════════════════════════
interface EmailIdRegistry {
    validIds: Set<string>;
    lastFetchTime: number;
}

export const useToolkit = () => {
    // Strict registry of valid email IDs - ONLY IDs from get_emails are allowed
    const emailIdRegistry = useRef<EmailIdRegistry>({
        validIds: new Set(),
        lastFetchTime: 0,
    });

    const runTool = useCallback(async (name: string, args: unknown) => {
        const a = asObject(args) ?? {};

        // ═══════════════════════════════════════════════════════════════════
        // 🔧 TOOL CALL LOGGING - See exactly what the agent is invoking
        // ═══════════════════════════════════════════════════════════════════
        console.log(`\n%c══════════════════════════════════════════════════════════════`, 'color: #6ee7b7');
        console.log(`%c🔧 TOOL CALL: ${name}`, 'color: #6ee7b7; font-weight: bold; font-size: 14px');
        console.log(`%c📋 ARGUMENTS:`, 'color: #fbbf24; font-weight: bold');
        console.log(JSON.stringify(a, null, 2));
        console.log(`%c⏳ Executing...`, 'color: #94a3b8');
        const startTime = performance.now();

        // Inner function to execute the tool - allows us to capture result for logging
        const executeTool = async (): Promise<unknown> => {
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
                    const data = await safeJson(resp);

                    // ═══════════════════════════════════════════════════════════════
                    // 🛡️ STRICT: Clear old IDs and register ONLY new valid IDs
                    // ═══════════════════════════════════════════════════════════════
                    emailIdRegistry.current.validIds.clear();
                    emailIdRegistry.current.lastFetchTime = Date.now();

                    if (data && Array.isArray(data.emails)) {
                        for (const email of data.emails) {
                            if (email && typeof email.id === 'string') {
                                emailIdRegistry.current.validIds.add(email.id);
                            }
                        }
                        console.log(`%c🛡️ EMAIL ID REGISTRY: Registered ${emailIdRegistry.current.validIds.size} valid IDs`, 'color: #22d3ee; font-weight: bold');
                        console.log(`%c   Valid IDs: ${Array.from(emailIdRegistry.current.validIds).join(', ')}`, 'color: #94a3b8');
                    }

                    return data;
                }
                case 'search_emails': {
                    const resp = await fetch('/api/gmail/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: a.query, maxResults: (a.maxResults as number | undefined) ?? 5 }),
                    });
                    const data = await safeJson(resp);

                    // 🛡️ STRICT: Register IDs from search results too
                    if (data && Array.isArray(data.emails)) {
                        // Clear and register new IDs (search replaces previous batch)
                        emailIdRegistry.current.validIds.clear();
                        emailIdRegistry.current.lastFetchTime = Date.now();
                        for (const email of data.emails) {
                            if (email && typeof email.id === 'string') {
                                emailIdRegistry.current.validIds.add(email.id);
                            }
                        }
                        console.log(`%c🛡️ EMAIL ID REGISTRY (search): Registered ${emailIdRegistry.current.validIds.size} valid IDs`, 'color: #22d3ee; font-weight: bold');
                    }

                    return data;
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
                case 'delete_email':
                case 'mark_email_read':
                case 'mark_email_unread':
                case 'star_email':
                case 'archive_email': {
                    const emailId = a.emailId as string;

                    // 🛡️ STRICT: Validate email ID before any operation
                    if (!emailId || typeof emailId !== 'string') {
                        return {
                            error: 'INVALID_REQUEST',
                            message: 'No email ID provided. Call get_emails first.',
                            action_required: 'Call get_emails to fetch emails and get valid IDs.'
                        };
                    }

                    // Allow IDs that were fetched (even if already used for get_email_by_id)
                    // But block completely unknown IDs
                    const wasEverValid = emailIdRegistry.current.validIds.has(emailId) ||
                        emailIdRegistry.current.lastFetchTime > 0; // At least one fetch happened

                    if (emailIdRegistry.current.validIds.size === 0 && emailIdRegistry.current.lastFetchTime === 0) {
                        return {
                            error: 'NO_EMAILS_FETCHED',
                            message: 'You have not fetched any emails yet. Call get_emails FIRST.',
                            action_required: 'Call get_emails to fetch the email list first.'
                        };
                    }

                    // Map tool names to endpoints
                    const endpointMap: Record<string, string> = {
                        'delete_email': '/api/gmail/delete',
                        'mark_email_read': '/api/gmail/mark-read',
                        'mark_email_unread': '/api/gmail/mark-unread',
                        'star_email': '/api/gmail/star',
                        'archive_email': '/api/gmail/archive',
                    };

                    const resp = await fetch(endpointMap[name], {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ emailId }),
                    });
                    return await safeJson(resp);
                }
                case 'create_draft': {
                    const resp = await fetch('/api/gmail/drafts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: a.to, subject: a.subject, text: a.text, cc: a.cc, bcc: a.bcc }),
                    });
                    return await safeJson(resp);
                }
                case 'list_drafts': {
                    const resp = await fetch(`/api/gmail/drafts?maxResults=${a.maxResults || 10}`);
                    return await safeJson(resp);
                }
                case 'update_draft': {
                    const resp = await fetch(`/api/gmail/drafts/${a.draftId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: a.to, subject: a.subject, text: a.text, cc: a.cc, bcc: a.bcc }),
                    });
                    return await safeJson(resp);
                }
                case 'send_draft': {
                    const resp = await fetch(`/api/gmail/drafts/${a.draftId}/send`, {
                        method: 'POST',
                    });
                    return await safeJson(resp);
                }
                case 'delete_draft': {
                    const resp = await fetch(`/api/gmail/drafts/${a.draftId}`, {
                        method: 'DELETE',
                    });
                    return await safeJson(resp);
                }
                case 'forward_email': {
                    const emailId = a.emailId as string;

                    // 🛡️ STRICT: Validate email ID before forward
                    if (!emailId || typeof emailId !== 'string') {
                        return {
                            error: 'INVALID_REQUEST',
                            message: 'No email ID provided. Call get_emails first.',
                            action_required: 'Call get_emails to fetch emails and get valid IDs.'
                        };
                    }

                    if (emailIdRegistry.current.validIds.size === 0 && emailIdRegistry.current.lastFetchTime === 0) {
                        return {
                            error: 'NO_EMAILS_FETCHED',
                            message: 'You have not fetched any emails yet. Call get_emails FIRST.',
                            action_required: 'Call get_emails to fetch the email list first.'
                        };
                    }

                    const resp = await fetch(`/api/gmail/forward/${emailId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: a.to, text: a.text }),
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
                    const emailId = a.emailId as string;

                    // ═══════════════════════════════════════════════════════════════
                    // 🛡️ STRICT VALIDATION: Block ALL fabricated/unknown email IDs
                    // ═══════════════════════════════════════════════════════════════
                    if (!emailId || typeof emailId !== 'string') {
                        console.log(`%c🚫 BLOCKED: No email ID provided`, 'color: #ef4444; font-weight: bold');
                        return {
                            error: 'INVALID_REQUEST',
                            message: 'No email ID provided. You MUST call get_emails first to get valid IDs.',
                            action_required: 'Call get_emails to fetch emails and get valid IDs.'
                        };
                    }

                    // Check if this ID was returned by get_emails
                    if (!emailIdRegistry.current.validIds.has(emailId)) {
                        console.log(`%c🚫 BLOCKED FABRICATED ID: "${emailId}"`, 'color: #ef4444; font-weight: bold; font-size: 14px');
                        console.log(`%c   Valid IDs in registry: ${Array.from(emailIdRegistry.current.validIds).join(', ') || '(empty - call get_emails first!)'}`, 'color: #fbbf24');

                        // Check if registry is empty (never called get_emails)
                        if (emailIdRegistry.current.validIds.size === 0) {
                            return {
                                error: 'NO_EMAILS_FETCHED',
                                message: 'You have not fetched any emails yet. You MUST call get_emails FIRST before calling get_email_by_id.',
                                action_required: 'Call get_emails to fetch the email list, then use IDs from that response.',
                                hint: 'The get_emails function returns a list of emails with their IDs. Use those exact IDs.'
                            };
                        }

                        // Registry has IDs but this one isn't in it = fabricated
                        return {
                            error: 'FABRICATED_EMAIL_ID',
                            message: `The email ID "${emailId}" was NOT returned by get_emails. This ID appears to be fabricated or hallucinated.`,
                            action_required: 'You MUST call get_emails AGAIN to fetch the next batch of emails. Do NOT guess or modify IDs.',
                            valid_ids_hint: `Current valid IDs: ${Array.from(emailIdRegistry.current.validIds).slice(0, 3).join(', ')}${emailIdRegistry.current.validIds.size > 3 ? '...' : ''}`,
                            reminder: 'To get MORE emails, call get_emails again. Never fabricate IDs.'
                        };
                    }

                    // ID is valid - proceed with the API call
                    console.log(`%c✅ VALID EMAIL ID: "${emailId}"`, 'color: #22c55e; font-weight: bold');
                    const resp = await fetch(`/api/gmail/email/${emailId}`);
                    const data = await safeJson(resp);

                    // After successfully fetching, remove from registry (one-time use)
                    // This prevents re-using old IDs and forces fetching new batches
                    emailIdRegistry.current.validIds.delete(emailId);
                    console.log(`%c🗑️ Removed used ID from registry. Remaining: ${emailIdRegistry.current.validIds.size}`, 'color: #94a3b8');

                    return data;
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
                case 'analyze_documents': {
                    const resp = await fetch('/api/vision/analyze-documents', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            images: a.images,
                            query: a.query
                        }),
                    });
                    return await safeJson(resp);
                }
                case 'browse_url': {
                    const resp = await fetch('/api/browsing/browse-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: a.url }),
                    });
                    return await safeJson(resp);
                }
                case 'extract_data': {
                    const resp = await fetch('/api/browsing/extract-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: a.url, selector: a.selector }),
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
                case 'disconnect_session': {
                    // This is a client-side signal; the component using this hook 
                    // should listen for this call or we just return a special signal.
                    // In this architecture, returning a specific success message is enough
                    // for the model to know it "worked", but the actual disconnect
                    // needs to happen in the UI layer or via an event listener.
                    // For now, we will assume the model stops context.
                    return { success: true, message: 'Session disconnected' };
                }
                default:
                    return { error: `Unknown tool: ${name}` };
            }
        };

        // Execute and log the result
        let result: unknown;
        let hasError = false;

        try {
            result = await executeTool();
        } catch (err) {
            hasError = true;
            result = { error: err instanceof Error ? err.message : 'Unknown error' };
        }

        // ═══════════════════════════════════════════════════════════════════
        // 📊 TOOL RESULT LOGGING
        // ═══════════════════════════════════════════════════════════════════
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        if (hasError) {
            console.log(`%c❌ TOOL FAILED: ${name}`, 'color: #ef4444; font-weight: bold');
        } else {
            console.log(`%c✅ TOOL SUCCESS: ${name}`, 'color: #22c55e; font-weight: bold');
        }
        console.log(`%c⏱️ Duration: ${duration}ms`, 'color: #94a3b8');
        console.log(`%c📤 RESULT:`, 'color: #60a5fa; font-weight: bold');
        console.log(result);
        console.log(`%c══════════════════════════════════════════════════════════════\n`, 'color: #6ee7b7');

        return result;
    }, []);

    const toolkitDefinitions = [
        // Google OAuth
        { type: 'function', name: 'google_auth_setup', description: 'Opens an OAuth window for the user to authenticate with Google, granting access to Gmail and Calendar. Call this when the user wants to connect their Google account. The window will open automatically.', parameters: { type: 'object', properties: {} } },

        // Gmail CRUD Operations
        { type: 'function', name: 'get_emails', description: "Gets email list with METADATA ONLY. Returns array of emails, each with: id (string), subject, from, date, snippet. Does NOT return full bodies. IMPORTANT: Use the 'id' field from this response to call get_email_by_id. CRITICAL: When you finish processing all emails in a batch, you MUST call get_emails AGAIN to fetch the next batch. NEVER fabricate or guess email IDs - the ONLY way to get more email IDs is to call this function again. Example: after processing 5 emails, call get_emails to get the next 5.", parameters: { type: 'object', properties: { maxResults: { type: 'number', default: 5, description: 'Number of emails to fetch. Call again to get next batch.' } } } },
        { type: 'function', name: 'get_email_by_id', description: 'Gets FULL email content by ID. CRITICAL: Only use email IDs from get_emails response. The ID must be the exact string from the "id" field in get_emails. NEVER guess or modify IDs.', parameters: { type: 'object', properties: { emailId: { type: 'string', description: 'EXACT email ID from get_emails response (e.g., "19b6a88c857268d9")' } }, required: ['emailId'] } },
        { type: 'function', name: 'search_emails', description: 'Searches emails in Gmail with a query. Returns METADATA only, not full bodies.', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number', default: 5 } }, required: ['query'] } },
        { type: 'function', name: 'send_email', description: 'DEPRECATED - Use create_draft instead. This tool is disabled for safety.', parameters: { type: 'object', properties: {} } },
        { type: 'function', name: 'reply_to_email', description: 'DEPRECATED - Use create_draft instead. This tool is disabled for safety. To reply to an email, create a draft with the appropriate subject and recipient.', parameters: { type: 'object', properties: {} } },
        { type: 'function', name: 'summarize_emails', description: 'Gets and summarizes recent emails. Call this when user wants email summary.', parameters: { type: 'object', properties: { maxResults: { type: 'number', default: 5 } } } },
        { type: 'function', name: 'delete_email', description: 'Deletes or trashes an email in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string', description: 'REAL hex ID from tool result. DO NOT HALLUCINATE.' } }, required: ['emailId'] } },
        { type: 'function', name: 'mark_email_read', description: 'Marks an email as read in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string', description: 'REAL hex ID from tool result. DO NOT HALLUCINATE.' } }, required: ['emailId'] } },
        { type: 'function', name: 'mark_email_unread', description: 'Marks an email as unread in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string', description: 'REAL hex ID from tool result. DO NOT HALLUCINATE.' } }, required: ['emailId'] } },
        { type: 'function', name: 'star_email', description: 'Stars an email in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string', description: 'REAL hex ID from tool result. DO NOT HALLUCINATE.' } }, required: ['emailId'] } },
        { type: 'function', name: 'archive_email', description: 'Archives an email (removes from Inbox) in Gmail.', parameters: { type: 'object', properties: { emailId: { type: 'string', description: 'REAL hex ID from tool result. DO NOT HALLUCINATE.' } }, required: ['emailId'] } },

        // Draft Operations
        { type: 'function', name: 'create_draft', description: 'Creates and SAVES a draft email (does NOT send). Use this when user wants to draft/compose an email for later.', parameters: { type: 'object', properties: { to: { type: 'string', description: 'Recipient email address' }, subject: { type: 'string', description: 'Email subject' }, text: { type: 'string', description: 'Email body text' }, cc: { type: 'string' }, bcc: { type: 'string' } }, required: ['to', 'subject', 'text'] } },
        { type: 'function', name: 'list_drafts', description: 'Lists all draft emails in Gmail.', parameters: { type: 'object', properties: { maxResults: { type: 'number', default: 10 } } } },
        { type: 'function', name: 'update_draft', description: 'Updates an existing draft email.', parameters: { type: 'object', properties: { draftId: { type: 'string', description: 'Draft ID from list_drafts' }, to: { type: 'string' }, subject: { type: 'string' }, text: { type: 'string' }, cc: { type: 'string' }, bcc: { type: 'string' } }, required: ['draftId'] } },
        { type: 'function', name: 'send_draft', description: 'Sends a previously created draft email.', parameters: { type: 'object', properties: { draftId: { type: 'string', description: 'Draft ID from list_drafts' } }, required: ['draftId'] } },
        { type: 'function', name: 'delete_draft', description: 'Deletes a draft email.', parameters: { type: 'object', properties: { draftId: { type: 'string', description: 'Draft ID from list_drafts' } }, required: ['draftId'] } },
        { type: 'function', name: 'forward_email', description: 'Forwards an email to another recipient.', parameters: { type: 'object', properties: { emailId: { type: 'string', description: 'Email ID to forward' }, to: { type: 'string', description: 'Recipient email address' }, text: { type: 'string', description: 'Optional message to add' } }, required: ['emailId', 'to'] } },

        // Calendar Operations
        { type: 'function', name: 'create_calendar_event', description: "Creates a new event in the user's Google Calendar.", parameters: { type: 'object', properties: { summary: { type: 'string', description: 'Title of the event' }, description: { type: 'string', description: 'Description or details of the event' }, start: { type: 'string', description: 'Start time in ISO 8601 format' }, end: { type: 'string', description: 'End time in ISO 8601 format' }, location: { type: 'string', description: 'Location of the event' }, attendees: { type: 'array', items: { type: 'string' }, description: 'List of email addresses to invite' } }, required: ['summary', 'start', 'end'] } },
        { type: 'function', name: 'list_calendar_events', description: "Lists upcoming events from the user's primary calendar.", parameters: { type: 'object', properties: { timeMin: { type: 'string', description: 'ISO start time (defaults to now)' }, timeMax: { type: 'string', description: 'ISO end time' }, maxResults: { type: 'number' }, query: { type: 'string', description: 'Search term for events' } } } },
        { type: 'function', name: 'update_calendar_event', description: 'Updates an existing calendar event.', parameters: { type: 'object', properties: { eventId: { type: 'string' }, summary: { type: 'string' }, description: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, location: { type: 'string' } }, required: ['eventId'] } },
        { type: 'function', name: 'delete_calendar_event', description: 'Deletes an event from Google Calendar.', parameters: { type: 'object', properties: { eventId: { type: 'string' } }, required: ['eventId'] } },

        // Web & Information
        { type: 'function', name: 'web_search', description: 'Search the web for any information, news, or results.', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
        { type: 'function', name: 'browse_url', description: 'Fetches and extracts content from any URL. Returns title, description, main content, and links. Use this to read articles, documentation, or any web page.', parameters: { type: 'object', properties: { url: { type: 'string', description: 'The URL to browse and extract content from' } }, required: ['url'] } },
        { type: 'function', name: 'extract_data', description: 'Extracts structured data from a web page (headings, paragraphs, lists). Can use CSS selectors for specific extraction.', parameters: { type: 'object', properties: { url: { type: 'string', description: 'The URL to extract data from' }, selector: { type: 'string', description: 'Optional CSS selector to extract specific elements' } }, required: ['url'] } },

        // Vision & Document Analysis
        { type: 'function', name: 'analyze_documents', description: 'Analyzes uploaded images or documents using GPT-5.2 vision. Can analyze screenshots, photos of documents, diagrams, spreadsheets, receipts, contracts, etc. Supports multiple images at once. User can show you documents via camera.', parameters: { type: 'object', properties: { images: { type: 'array', items: { type: 'string' }, description: 'Array of base64 encoded images to analyze' }, query: { type: 'string', description: 'What to analyze or extract. E.g., "Extract all text", "Summarize this document", "What are the key insights?", "Extract receipt total and items"' } }, required: ['images', 'query'] } },

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
        // System
        { type: 'function', name: 'disconnect_session', description: 'Disconnects and ends the current voice session immediately.', parameters: { type: 'object', properties: {} } },
    ];

    return {
        runTool,
        toolkitDefinitions,
    };
};
