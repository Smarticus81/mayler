import { google } from 'googleapis';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gmail API and Calendar scopes - EXPANDED
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose', // For drafts
  'https://www.googleapis.com/auth/gmail.labels', // For labels
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const TOKEN_PATH = path.join(__dirname, 'gmail-token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'gmail-credentials.json');

class GmailService {
  constructor() {
    this.auth = null;
    this.gmail = null;
    this.calendar = null;
  }

  async initialize() {
    try {
      // Prefer credentials from environment for cloud deployments
      let credentials = null;
      const credsFromEnv = process.env.GMAIL_CREDENTIALS_JSON;
      if (credsFromEnv) {
        try {
          credentials = JSON.parse(credsFromEnv);
        } catch (e) {
          console.error('Failed to parse GMAIL_CREDENTIALS_JSON env var:', e?.message);
          return false;
        }
      } else {
        // Fallback to credentials file on local/dev
        const credentialsExist = await fs.access(CREDENTIALS_PATH).then(() => true).catch(() => false);
        if (!credentialsExist) {
          console.log('Gmail credentials not found. Provide GMAIL_CREDENTIALS_JSON env var or add backend/gmail-credentials.json.');
          return false;
        }
        credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf8'));
      }
      const { client_secret, client_id } = credentials.installed || credentials.web;

      // Use our auth redirect endpoint - prefer env var for flexibility
      const redirectUri = process.env.OAUTH_REDIRECT_URI ||
        (process.env.NODE_ENV === 'production'
          ? 'https://tisang-production.up.railway.app/api/gmail/auth-redirect'
          : 'http://localhost:3000/api/gmail/auth-redirect');

      this.auth = new google.auth.OAuth2(client_id, client_secret, redirectUri);

      // Check if we have a stored token (prefer env var for cloud)
      const tokenFromEnv = process.env.GMAIL_TOKEN_JSON;
      if (tokenFromEnv) {
        try {
          this.auth.setCredentials(JSON.parse(tokenFromEnv));
        } catch (e) {
          console.error('Failed to parse GMAIL_TOKEN_JSON env var:', e?.message);
          return false;
        }
      } else {
        try {
          const token = await fs.readFile(TOKEN_PATH, 'utf8');
          this.auth.setCredentials(JSON.parse(token));
        } catch (err) {
          console.log('No stored Gmail token found. Gmail features will require authentication.');
        }
      }

      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });

      return true;
    } catch (error) {
      console.error('Failed to initialize Gmail service:', error);
      return false;
    }
  }

  async getAuthUrl() {
    if (!this.auth) {
      throw new Error('Gmail service not initialized');
    }

    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    return authUrl;
  }

  async setAuthCode(code) {
    if (!this.auth) {
      throw new Error('Gmail service not initialized');
    }

    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);

    // Store the token for future use
    try {
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
    } catch (e) {
      console.warn('Could not persist gmail-token.json to disk. For Railway, set GMAIL_TOKEN_JSON env var with token JSON.');
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
    return true;
  }

  async handleAuthCallback(code) {
    return this.setAuthCode(code);
  }

  // ==================== EMAIL READ OPERATIONS ====================

  async getRecentEmails(maxResults = 50) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox'
      });

      if (!response.data.messages) return [];

      const emails = [];
      for (const message of response.data.messages.slice(0, Math.min(maxResults, 50))) {
        const email = await this.getEmailById(message.id);
        emails.push(email);
      }

      return emails;
    } catch (error) {
      console.error('Failed to get emails:', error?.message || error);
      throw new Error(`Failed to retrieve emails: ${error?.message || 'Unknown error'}`);
    }
  }

  async searchEmails(query, maxResults = 25) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query
      });

      if (!response.data.messages) return [];

      const emails = [];
      for (const message of response.data.messages) {
        const email = await this.getEmailById(message.id);
        emails.push(email);
      }

      return emails;
    } catch (error) {
      console.error('Failed to search emails:', error);
      throw new Error('Failed to search emails');
    }
  }

  async getEmailById(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const email = await this.gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full'
      });

      const headers = email.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const to = headers.find(h => h.name === 'To')?.value || 'Unknown';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const messageId = headers.find(h => h.name === 'Message-ID')?.value || '';

      // Extract body
      let body = '';
      let htmlBody = '';
      const parts = this._extractParts(email.data.payload);

      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString();
        }
      }

      // Extract attachments
      const attachments = parts
        .filter(part => part.filename && part.body?.attachmentId)
        .map(part => ({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
          attachmentId: part.body.attachmentId
        }));

      return {
        id: emailId,
        subject,
        from,
        to,
        date,
        messageId,
        snippet: email.data.snippet,
        body: body.slice(0, 1000), // Limit for voice
        htmlBody,
        threadId: email.data.threadId,
        labelIds: email.data.labelIds || [],
        attachments,
        isRead: !email.data.labelIds?.includes('UNREAD'),
        isStarred: email.data.labelIds?.includes('STARRED'),
        isImportant: email.data.labelIds?.includes('IMPORTANT')
      };
    } catch (error) {
      console.error('Failed to get email:', error);
      throw new Error('Failed to retrieve email');
    }
  }

  async getEmailThread(threadId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const thread = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      const messages = [];
      for (const message of thread.data.messages || []) {
        const email = await this.getEmailById(message.id);
        messages.push(email);
      }

      return {
        id: threadId,
        snippet: thread.data.snippet,
        messages,
        messageCount: messages.length
      };
    } catch (error) {
      console.error('Failed to get thread:', error);
      throw new Error('Failed to retrieve thread');
    }
  }

  // ==================== EMAIL WRITE OPERATIONS ====================

  async sendEmail({ to, subject, text, cc, bcc, html, replyTo, threadId, inReplyTo, references }) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const headers = [
        `To: ${to}`,
        `Subject: ${subject}`
      ];

      if (cc) headers.push(`Cc: ${cc}`);
      if (bcc) headers.push(`Bcc: ${bcc}`);
      if (replyTo) headers.push(`Reply-To: ${replyTo}`);
      if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
      if (references) headers.push(`References: ${references}`);

      const boundary = '----=_Part_' + Date.now();
      let body = headers.join('\r\n');

      if (html) {
        body += `\r\nMIME-Version: 1.0\r\n`;
        body += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
        body += text || '';
        body += `\r\n\r\n--${boundary}\r\n`;
        body += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
        body += html;
        body += `\r\n\r\n--${boundary}--`;
      } else {
        body += '\r\n\r\n' + text;
      }

      const encodedEmail = Buffer.from(body)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const params = {
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      };

      if (threadId) {
        params.requestBody.threadId = threadId;
      }

      const result = await this.gmail.users.messages.send(params);

      return {
        id: result.data.id,
        threadId: result.data.threadId,
        labelIds: result.data.labelIds
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email: ' + error.message);
    }
  }

  async replyToEmail(emailId, text, html) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const originalEmail = await this.getEmailById(emailId);
      const toMatch = originalEmail.from.match(/<(.+?)>/) || [null, originalEmail.from];
      const to = toMatch[1];

      let subject = originalEmail.subject;
      if (!subject.toLowerCase().startsWith('re:')) {
        subject = 'Re: ' + subject;
      }

      const messageIdHeader = originalEmail.messageId || `<${originalEmail.id}@mail.gmail.com>`;

      return await this.sendEmail({
        to,
        subject,
        text,
        html,
        threadId: originalEmail.threadId,
        inReplyTo: messageIdHeader,
        references: messageIdHeader
      });
    } catch (error) {
      console.error('Failed to reply to email:', error);
      throw new Error('Failed to reply to email');
    }
  }

  async forwardEmail(emailId, to, text, html) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const originalEmail = await this.getEmailById(emailId);

      let subject = originalEmail.subject;
      if (!subject.toLowerCase().startsWith('fwd:')) {
        subject = 'Fwd: ' + subject;
      }

      // Add forwarding context
      const forwardedText = `
---------- Forwarded message ---------
From: ${originalEmail.from}
Date: ${originalEmail.date}
Subject: ${originalEmail.subject}
To: ${originalEmail.to}

${originalEmail.body}
`;

      const finalText = text ? `${text}\n\n${forwardedText}` : forwardedText;

      return await this.sendEmail({
        to,
        subject,
        text: finalText,
        html
      });
    } catch (error) {
      console.error('Failed to forward email:', error);
      throw new Error('Failed to forward email');
    }
  }

  // ==================== DRAFT OPERATIONS ====================

  async createDraft({ to, subject, text, cc, bcc, html }) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const headers = [
        `To: ${to}`,
        `Subject: ${subject}`
      ];

      if (cc) headers.push(`Cc: ${cc}`);
      if (bcc) headers.push(`Bcc: ${bcc}`);

      let body = headers.join('\r\n') + '\r\n\r\n' + text;

      const encodedEmail = Buffer.from(body)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedEmail
          }
        }
      });

      return {
        id: result.data.id,
        message: result.data.message
      };
    } catch (error) {
      console.error('Failed to create draft:', error);
      throw new Error('Failed to create draft');
    }
  }

  async listDrafts(maxResults = 10) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const response = await this.gmail.users.drafts.list({
        userId: 'me',
        maxResults
      });

      if (!response.data.drafts) return [];

      const drafts = [];
      for (const draft of response.data.drafts) {
        const fullDraft = await this.gmail.users.drafts.get({
          userId: 'me',
          id: draft.id
        });
        drafts.push({
          id: fullDraft.data.id,
          message: await this.getEmailById(fullDraft.data.message.id)
        });
      }

      return drafts;
    } catch (error) {
      console.error('Failed to list drafts:', error);
      throw new Error('Failed to list drafts');
    }
  }

  async updateDraft(draftId, { to, subject, text, cc, bcc }) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      // Delete old draft and create new one
      await this.deleteDraft(draftId);
      return await this.createDraft({ to, subject, text, cc, bcc });
    } catch (error) {
      console.error('Failed to update draft:', error);
      throw new Error('Failed to update draft');
    }
  }

  async sendDraft(draftId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const result = await this.gmail.users.drafts.send({
        userId: 'me',
        requestBody: {
          id: draftId
        }
      });

      return {
        id: result.data.id,
        threadId: result.data.threadId,
        labelIds: result.data.labelIds
      };
    } catch (error) {
      console.error('Failed to send draft:', error);
      throw new Error('Failed to send draft');
    }
  }

  async deleteDraft(draftId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.drafts.delete({
        userId: 'me',
        id: draftId
      });

      return { success: true, id: draftId };
    } catch (error) {
      console.error('Failed to delete draft:', error);
      throw new Error('Failed to delete draft');
    }
  }

  // ==================== EMAIL MANAGEMENT ====================

  async deleteEmail(emailId, permanent = false) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      if (permanent) {
        await this.gmail.users.messages.delete({
          userId: 'me',
          id: emailId
        });
      } else {
        await this.gmail.users.messages.trash({
          userId: 'me',
          id: emailId
        });
      }

      return { success: true, id: emailId, permanent };
    } catch (error) {
      console.error('Failed to delete email:', error);
      throw new Error('Failed to delete email');
    }
  }

  async archiveEmail(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: ['INBOX']
        }
      });

      return { success: true, id: emailId };
    } catch (error) {
      console.error('Failed to archive email:', error);
      throw new Error('Failed to archive email');
    }
  }

  async markAsRead(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

      return { success: true, id: emailId };
    } catch (error) {
      console.error('Failed to mark as read:', error);
      throw new Error('Failed to mark as read');
    }
  }

  async markAsUnread(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          addLabelIds: ['UNREAD']
        }
      });

      return { success: true, id: emailId };
    } catch (error) {
      console.error('Failed to mark as unread:', error);
      throw new Error('Failed to mark as unread');
    }
  }

  async starEmail(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          addLabelIds: ['STARRED']
        }
      });

      return { success: true, id: emailId };
    } catch (error) {
      console.error('Failed to star email:', error);
      throw new Error('Failed to star email');
    }
  }

  async unstarEmail(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: ['STARRED']
        }
      });

      return { success: true, id: emailId };
    } catch (error) {
      console.error('Failed to unstar email:', error);
      throw new Error('Failed to unstar email');
    }
  }

  async markAsImportant(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          addLabelIds: ['IMPORTANT']
        }
      });

      return { success: true, id: emailId };
    } catch (error) {
      console.error('Failed to mark as important:', error);
      throw new Error('Failed to mark as important');
    }
  }

  async markAsSpam(emailId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          addLabelIds: ['SPAM'],
          removeLabelIds: ['INBOX']
        }
      });

      return { success: true, id: emailId };
    } catch (error) {
      console.error('Failed to mark as spam:', error);
      throw new Error('Failed to mark as spam');
    }
  }

  // ==================== LABEL OPERATIONS ====================

  async addLabel(emailId, labelId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          addLabelIds: [labelId]
        }
      });

      return { success: true, id: emailId, labelId };
    } catch (error) {
      console.error('Failed to add label:', error);
      throw new Error('Failed to add label');
    }
  }

  async removeLabel(emailId, labelId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: [labelId]
        }
      });

      return { success: true, id: emailId, labelId };
    } catch (error) {
      console.error('Failed to remove label:', error);
      throw new Error('Failed to remove label');
    }
  }

  async listLabels() {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me'
      });

      return response.data.labels || [];
    } catch (error) {
      console.error('Failed to list labels:', error);
      throw new Error('Failed to list labels');
    }
  }

  async createLabel(name, labelListVisibility = 'labelShow', messageListVisibility = 'show') {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const result = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name,
          labelListVisibility,
          messageListVisibility
        }
      });

      return result.data;
    } catch (error) {
      console.error('Failed to create label:', error);
      throw new Error('Failed to create label');
    }
  }

  // ==================== BULK OPERATIONS ====================

  async bulkArchive(emailIds) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: emailIds,
          removeLabelIds: ['INBOX']
        }
      });

      return { success: true, count: emailIds.length };
    } catch (error) {
      console.error('Failed to bulk archive:', error);
      throw new Error('Failed to bulk archive');
    }
  }

  async bulkDelete(emailIds, permanent = false) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      if (permanent) {
        await this.gmail.users.messages.batchDelete({
          userId: 'me',
          requestBody: {
            ids: emailIds
          }
        });
      } else {
        await this.gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: emailIds,
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX']
          }
        });
      }

      return { success: true, count: emailIds.length, permanent };
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      throw new Error('Failed to bulk delete');
    }
  }

  async bulkMarkAsRead(emailIds) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      await this.gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: emailIds,
          removeLabelIds: ['UNREAD']
        }
      });

      return { success: true, count: emailIds.length };
    } catch (error) {
      console.error('Failed to bulk mark as read:', error);
      throw new Error('Failed to bulk mark as read');
    }
  }

  // ==================== ATTACHMENT OPERATIONS ====================

  async getAttachment(messageId, attachmentId) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const attachment = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId
      });

      return {
        data: attachment.data.data, // base64 encoded
        size: attachment.data.size
      };
    } catch (error) {
      console.error('Failed to get attachment:', error);
      throw new Error('Failed to get attachment');
    }
  }

  // ==================== ANALYTICS ====================

  async getEmailAnalytics(days = 30) {
    if (!this.gmail) throw new Error('Gmail not authenticated');

    try {
      const after = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: `after:${after}`,
        maxResults: 500
      });

      if (!response.data.messages) {
        return {
          totalEmails: 0,
          topSenders: [],
          averageResponseTime: null,
          unreadCount: 0
        };
      }

      // Fetch details for analysis
      const emails = [];
      for (const message of response.data.messages.slice(0, 100)) {
        const email = await this.getEmailById(message.id);
        emails.push(email);
      }

      // Analyze senders
      const senderCounts = {};
      for (const email of emails) {
        const sender = email.from;
        senderCounts[sender] = (senderCounts[sender] || 0) + 1;
      }

      const topSenders = Object.entries(senderCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([sender, count]) => ({ sender, count }));

      const unreadCount = emails.filter(e => !e.isRead).length;

      return {
        totalEmails: response.data.messages.length,
        topSenders,
        unreadCount,
        readRate: ((emails.length - unreadCount) / emails.length * 100).toFixed(1) + '%'
      };
    } catch (error) {
      console.error('Failed to get analytics:', error);
      throw new Error('Failed to get analytics');
    }
  }

  // ==================== CALENDAR OPERATIONS ====================

  async createCalendarEvent({ summary, description, start, end, timezone, attendees, location, reminders }) {
    if (!this.calendar) throw new Error('Calendar not authenticated');

    try {
      const startObj = {};
      if (typeof start === 'string') {
        startObj.dateTime = start;
        startObj.timeZone = timezone || 'America/Los_Angeles';
      } else if (start.dateTime) {
        startObj.dateTime = start.dateTime;
        startObj.timeZone = timezone || 'America/Los_Angeles';
      } else if (start.date) {
        startObj.date = start.date;
      } else {
        throw new Error('Start date/dateTime is required');
      }

      const endObj = {};
      if (typeof end === 'string') {
        endObj.dateTime = end;
        endObj.timeZone = timezone || 'America/Los_Angeles';
      } else if (end.dateTime) {
        endObj.dateTime = end.dateTime;
        endObj.timeZone = timezone || 'America/Los_Angeles';
      } else if (end.date) {
        endObj.date = end.date;
      } else {
        throw new Error('End date/dateTime is required');
      }

      const event = {
        summary,
        description,
        location,
        start: startObj,
        end: endObj
      };

      if (attendees && attendees.length > 0) {
        event.attendees = attendees.map(email => ({ email }));
      }

      if (reminders) {
        event.reminders = {
          useDefault: false,
          overrides: reminders
        };
      } else {
        event.reminders = {
          useDefault: true
        };
      }

      const result = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event
      });

      return {
        id: result.data.id,
        htmlLink: result.data.htmlLink,
        summary: result.data.summary,
        start: result.data.start,
        end: result.data.end
      };
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw new Error('Failed to create calendar event: ' + error.message);
    }
  }

  async listCalendarEvents({ timeMin, timeMax, maxResults = 10, query }) {
    if (!this.calendar) throw new Error('Calendar not authenticated');

    try {
      const params = {
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      };

      if (query) {
        params.q = query;
      }

      const response = await this.calendar.events.list(params);

      if (!response.data.items) {
        return [];
      }

      return response.data.items.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        attendees: event.attendees,
        htmlLink: event.htmlLink,
        status: event.status
      }));
    } catch (error) {
      console.error('Failed to list calendar events:', error);
      throw new Error('Failed to list calendar events');
    }
  }

  async addActionItemToCalendar(actionItem, dueDate, priority = 'medium') {
    const reminderMinutes = priority === 'high' ? [60, 1440] : [1440];

    const start = new Date(dueDate);
    const end = new Date(start.getTime() + 30 * 60000);

    return await this.createCalendarEvent({
      summary: `📋 Action: ${actionItem}`,
      description: `Priority: ${priority}\n\nAction item created by Mayler voice assistant.`,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      reminders: reminderMinutes.map(minutes => ({ method: 'popup', minutes }))
    });
  }

  // ==================== HELPER METHODS ====================

  _extractParts(payload) {
    const parts = [];

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.parts) {
          parts.push(...this._extractParts(part));
        } else {
          parts.push(part);
        }
      }
    } else {
      parts.push(payload);
    }

    return parts;
  }
}

export default GmailService;