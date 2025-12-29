import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export const createBrowsingRouter = () => {
    const router = express.Router();

    // Browse and extract content from any URL
    router.post('/browse-url', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🌐 [Browsing API] Fetching URL content');
        console.log(`📋 URL: ${req.body.url}`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            const { url } = req.body;

            if (!url) {
                throw new Error('URL is required');
            }

            // Fetch the page
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Remove script and style elements
            $('script, style, nav, footer, header').remove();

            // Extract main content
            const title = $('title').text().trim();
            const metaDescription = $('meta[name="description"]').attr('content') || '';

            // Try to find main content
            let mainContent = '';
            const contentSelectors = ['main', 'article', '.content', '#content', '.post', '.article'];

            for (const selector of contentSelectors) {
                const content = $(selector).first().text().trim();
                if (content && content.length > mainContent.length) {
                    mainContent = content;
                }
            }

            // Fallback to body if no main content found
            if (!mainContent) {
                mainContent = $('body').text().trim();
            }

            // Clean up whitespace
            mainContent = mainContent.replace(/\s+/g, ' ').trim();

            // Limit content length
            const maxLength = 10000;
            if (mainContent.length > maxLength) {
                mainContent = mainContent.substring(0, maxLength) + '...';
            }

            // Extract links
            const links = [];
            $('a[href]').each((i, elem) => {
                if (i < 20) { // Limit to 20 links
                    const href = $(elem).attr('href');
                    const text = $(elem).text().trim();
                    if (href && text) {
                        links.push({ text, href });
                    }
                }
            });

            console.log(`✅ [Browsing API] Content extracted (${mainContent.length} chars)`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.json({
                success: true,
                url,
                title,
                description: metaDescription,
                content: mainContent,
                links,
                contentLength: mainContent.length
            });

        } catch (error) {
            console.error('❌ [Browsing API] Failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Extract specific data from a page
    router.post('/extract-data', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('🔍 [Browsing API] Extracting structured data');
        console.log(`📋 URL: ${req.body.url}`);
        console.log(`📝 Selector: ${req.body.selector || 'auto'}`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            const { url, selector } = req.body;

            if (!url) {
                throw new Error('URL is required');
            }

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            let data = {};

            if (selector) {
                // Extract specific selector
                const elements = $(selector);
                data.items = [];
                elements.each((i, elem) => {
                    data.items.push($(elem).text().trim());
                });
            } else {
                // Auto-extract structured data
                data.headings = [];
                $('h1, h2, h3').each((i, elem) => {
                    if (i < 10) {
                        data.headings.push($(elem).text().trim());
                    }
                });

                data.paragraphs = [];
                $('p').each((i, elem) => {
                    if (i < 10) {
                        const text = $(elem).text().trim();
                        if (text.length > 50) {
                            data.paragraphs.push(text);
                        }
                    }
                });

                data.lists = [];
                $('ul, ol').each((i, elem) => {
                    if (i < 5) {
                        const items = [];
                        $(elem).find('li').each((j, li) => {
                            if (j < 10) {
                                items.push($(li).text().trim());
                            }
                        });
                        data.lists.push(items);
                    }
                });
            }

            console.log(`✅ [Browsing API] Data extracted`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.json({
                success: true,
                url,
                data
            });

        } catch (error) {
            console.error('❌ [Browsing API] Failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
};
