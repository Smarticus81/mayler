import express from 'express';
import cors from 'cors';
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

// Load environment variables
dotenv.config();

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
// Note: gmailService initialization happens lazily/asynchronously in the router or via explicit call
const gmailService = new GmailService();
const utilityService = new UtilityService();
const searchService = new SearchService();

console.log('Services loaded');

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Initialize Routers
const tokenRouter = createTokenRouter();
const gmailRouter = createGmailRouter(gmailService);
const calendarRouter = createCalendarRouter(gmailService);
const utilityRouter = createUtilityRouter(utilityService);
const searchRouter = createSearchRouter(searchService);
const chatRouter = createChatRouter();

// Mount Routes
app.use('/api/token', tokenRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api', utilityRouter); // Mounts utility routes directly under /api (e.g. /api/weather)
app.use('/api', searchRouter);  // Mounts search routes directly under /api (e.g. /api/search)
app.use('/api/chat', chatRouter);

// Serve static files in production
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
