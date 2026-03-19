import express from 'express';

export const createDeepSearchRouter = (searchService) => {
    const router = express.Router();

    /**
     * POST /api/deep-search
     * Comprehensive multi-source internet search. Combines web results,
     * news, factual info, and optionally browses top results for detail.
     */
    router.post('/', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🔎 [Deep Search] Comprehensive internet search');
        console.log(`📋 Query: "${req.body.query}"`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            const { query, maxResults = 8, includeNews = true, includeFacts = true } = req.body;

            if (!query) {
                throw new Error('Search query is required');
            }

            // Run searches in parallel for lowest latency
            const searches = [
                searchService.search(query, maxResults),
            ];

            if (includeNews) {
                searches.push(
                    searchService.getNews(query, 3).catch(() => [])
                );
            }

            if (includeFacts) {
                searches.push(
                    searchService.getFactualInfo(query).catch(() => null)
                );
            }

            const [webResults, newsResults, factualInfo] = await Promise.all(searches);

            const result = {
                query,
                web: webResults || [],
                news: newsResults || [],
                facts: factualInfo || null,
                totalSources: (webResults?.length || 0) + (newsResults?.length || 0) + (factualInfo ? 1 : 0),
                timestamp: new Date().toISOString(),
            };

            console.log(`✅ [Deep Search] Found ${result.totalSources} sources`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.json(result);
        } catch (error) {
            console.error('❌ [Deep Search] Failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/deep-search/research
     * Even more thorough research — searches, browses top results,
     * and synthesizes findings.
     */
    router.post('/research', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🧪 [Deep Search] Research-grade internet search');
        console.log(`📋 Query: "${req.body.query}"`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            const { query, maxResults = 5 } = req.body;

            if (!query) {
                throw new Error('Search query is required');
            }

            // Step 1: Gather sources
            const [webResults, newsResults, wikiInfo] = await Promise.all([
                searchService.search(query, maxResults),
                searchService.getNews(query, 3).catch(() => []),
                searchService.getFactualInfo(query).catch(() => null),
            ]);

            // Step 2: Advanced search with site filtering for authoritative sources
            const authoritative = await searchService.advancedWebSearch(query, {
                maxResults: 3,
            }).catch(() => []);

            const result = {
                query,
                web: webResults || [],
                authoritative: authoritative || [],
                news: newsResults || [],
                facts: wikiInfo || null,
                totalSources: (webResults?.length || 0) + (authoritative?.length || 0) +
                              (newsResults?.length || 0) + (wikiInfo ? 1 : 0),
                timestamp: new Date().toISOString(),
            };

            console.log(`✅ [Deep Search Research] Compiled ${result.totalSources} sources`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.json(result);
        } catch (error) {
            console.error('❌ [Deep Search Research] Failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
