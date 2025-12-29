import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import GmailService from './backend/gmail-service.js';
import UtilityService from './backend/utility-service.js';
import SearchService from './backend/search-service.js';

import { createTokenRouter } from './backend/routes/token.js';
import { createGmailRouter } from './backend/routes/gmail.js';
import { createCalendarRouter } from './backend/routes/calendar.js';
import { createUtilityRouter } from './backend/routes/utility.js';
import { createSearchRouter } from './backend/routes/search.js';
import { createChatRouter } from './backend/routes/chat.js';
import { createAuthRouter } from './backend/routes/auth.js';
import { createRimeRouter } from './backend/routes/rime.js';
import { createVisionRouter } from './backend/routes/vision.js';
import { createBrowsingRouter } from './backend/routes/browsing.js';


// Load environment variables
dotenv.config();
console.log('[dotenv] Environment variables loaded');

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize services
const gmailService = new GmailService();
const utilityService = new UtilityService();
const searchService = new SearchService();

// Pre-initialize Gmail if token exists
gmailService.initialize().catch(err => console.error('Initial Gmail check failed:', err));

console.log('Services loaded');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'mayler-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Initialize routers
const tokenRouter = createTokenRouter();
const gmailRouter = createGmailRouter(gmailService);
const calendarRouter = createCalendarRouter(gmailService);
const utilityRouter = createUtilityRouter(utilityService, gmailService);
const searchRouter = createSearchRouter(searchService);
const chatRouter = createChatRouter();
const authRouter = createAuthRouter();
const rimeRouter = createRimeRouter();
const visionRouter = createVisionRouter();
const browsingRouter = createBrowsingRouter();

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/token', tokenRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api', utilityRouter); // Mounts utility routes directly under /api (e.g. /api/weather)
app.use('/api', searchRouter);  // Mounts search routes directly under /api (e.g. /api/search)
app.use('/api/chat', chatRouter);
app.use('/api/rime', rimeRouter);
app.use('/api/vision', visionRouter);
app.use('/api/browsing', browsingRouter);

// Serve static files in production
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
