import express from 'express';

export const createSearchRouter = (searchService) => {
    const router = express.Router();

    // Mounted at /api
    router.post('/search', async (req, res) => {
        try {
            const { query, maxResults = 5 } = req.body;
            if (!query) return res.status(400).json({ error: 'Search query required' });
            const results = await searchService.search(query, maxResults);
            res.json({ results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/search/news', async (req, res) => {
        try {
            const { topic = 'technology', maxResults = 3 } = req.body;
            const results = await searchService.getNews(topic, maxResults);
            res.json({ results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Alias for /news
    router.post('/news', async (req, res) => {
        try {
            const { category = 'technology', country = 'us', maxResults = 5 } = req.body;
            // Use topic as category
            const results = await searchService.getNews(category, maxResults);
            res.json({ articles: results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/search/facts', async (req, res) => {
        try {
            const { query } = req.body;
            if (!query) return res.status(400).json({ error: 'Query required' });
            const result = await searchService.getFactualInfo(query);
            res.json({ result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/search/images', async (req, res) => {
        try {
            const { query, maxResults = 5 } = req.body;
            if (!query) return res.status(400).json({ error: 'Query required' });
            const result = await searchService.searchImages(query, maxResults);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/search/videos', async (req, res) => {
        try {
            const { query, maxResults = 5 } = req.body;
            if (!query) return res.status(400).json({ error: 'Query required' });
            const result = await searchService.searchVideos(query, maxResults);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/search/advanced', async (req, res) => {
        try {
            const { query, timeRange, site, maxResults } = req.body;
            if (!query) return res.status(400).json({ error: 'Query required' });
            const result = await searchService.advancedWebSearch(query, { timeRange, site, maxResults });
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
