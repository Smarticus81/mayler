import fetch from 'node-fetch';

class SearchService {
  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
    this.newsApiKey = process.env.NEWS_API_KEY;
  }

  // Web search using Serper API (Google results) or DuckDuckGo fallback
  async search(query, maxResults = 5) {
    try {
      if (this.serperApiKey) {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': this.serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            num: maxResults
          })
        });
        
        const data = await response.json();
        
        const results = [];
        
        // Add knowledge panel if present
        if (data.knowledgeGraph) {
          results.push({
            type: 'knowledge',
            title: data.knowledgeGraph.title,
            description: data.knowledgeGraph.description,
            attributes: data.knowledgeGraph.attributes
          });
        }
        
        // Add answer box if present
        if (data.answerBox) {
          results.push({
            type: 'answer',
            title: data.answerBox.title,
            answer: data.answerBox.answer || data.answerBox.snippet,
            source: data.answerBox.link
          });
        }
        
        // Add organic results
        if (data.organic) {
          for (const item of data.organic.slice(0, maxResults)) {
            results.push({
              type: 'organic',
              title: item.title,
              snippet: item.snippet,
              url: item.link,
              date: item.date
            });
          }
        }
        
        return results;
      }
      
      // Fallback: DuckDuckGo instant answer API
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(ddgUrl);
      const data = await response.json();
      
      const results = [];
      
      // Abstract/Answer
      if (data.Abstract) {
        results.push({
          type: 'answer',
          title: data.Heading,
          answer: data.Abstract,
          source: data.AbstractSource,
          url: data.AbstractURL
        });
      }
      
      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
          if (topic.Text) {
            results.push({
              type: 'related',
              title: topic.Text.split(' - ')[0],
              snippet: topic.Text,
              url: topic.FirstURL
            });
          }
        }
      }
      
      // If no results from DDG, provide a generic response
      if (results.length === 0) {
        results.push({
          type: 'info',
          title: 'Search Results',
          snippet: `Search for "${query}" - consider using a web browser for detailed results.`,
          suggestion: 'For comprehensive web search results, please configure SERPER_API_KEY.'
        });
      }
      
      return results;
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed for "${query}"`);
    }
  }

  // News search
  async getNews(topic = 'technology', maxResults = 5) {
    try {
      if (this.newsApiKey) {
        const url = `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(topic)}&apiKey=${this.newsApiKey}&pageSize=${maxResults}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'ok' && data.articles) {
          return data.articles.map(article => ({
            title: article.title,
            description: article.description,
            source: article.source?.name,
            url: article.url,
            publishedAt: article.publishedAt,
            imageUrl: article.urlToImage
          }));
        }
      }
      
      // Fallback: Google News RSS via unofficial API
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(rssUrl);
      const text = await response.text();
      
      // Simple XML parsing for RSS items
      const items = [];
      const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
      
      for (const item of itemMatches.slice(0, maxResults)) {
        const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
        const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1];
        const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
        const source = item.match(/<source.*?>([\s\S]*?)<\/source>/)?.[1];
        
        if (title) {
          items.push({
            title: title.trim(),
            url: link,
            publishedAt: pubDate,
            source: source?.trim()
          });
        }
      }
      
      return items;
    } catch (error) {
      console.error('News fetch error:', error);
      throw new Error(`Could not fetch news for "${topic}"`);
    }
  }

  // Get factual info (combines multiple sources)
  async getFactualInfo(query) {
    try {
      // Try Wikipedia first for factual queries
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const wikiResponse = await fetch(wikiUrl);
      
      if (wikiResponse.ok) {
        const data = await wikiResponse.json();
        return {
          source: 'Wikipedia',
          title: data.title,
          summary: data.extract,
          url: data.content_urls?.desktop?.page
        };
      }
      
      // Fallback to DuckDuckGo
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const ddgResponse = await fetch(ddgUrl);
      const ddgData = await ddgResponse.json();
      
      if (ddgData.Abstract) {
        return {
          source: ddgData.AbstractSource || 'DuckDuckGo',
          title: ddgData.Heading,
          summary: ddgData.Abstract,
          url: ddgData.AbstractURL
        };
      }
      
      return {
        source: 'Search',
        title: query,
        summary: `No direct factual information found for "${query}". Try rephrasing or using web search for more results.`
      };
    } catch (error) {
      console.error('Factual info error:', error);
      throw new Error(`Could not find factual information for "${query}"`);
    }
  }

  // Image search (requires Serper API)
  async searchImages(query, maxResults = 5) {
    try {
      if (this.serperApiKey) {
        const response = await fetch('https://google.serper.dev/images', {
          method: 'POST',
          headers: {
            'X-API-KEY': this.serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            num: maxResults
          })
        });
        
        const data = await response.json();
        
        if (data.images) {
          return data.images.map(img => ({
            title: img.title,
            imageUrl: img.imageUrl,
            thumbnailUrl: img.thumbnailUrl,
            source: img.source,
            link: img.link
          }));
        }
      }
      
      return [{
        type: 'info',
        message: 'Image search requires SERPER_API_KEY configuration.'
      }];
    } catch (error) {
      console.error('Image search error:', error);
      throw new Error(`Image search failed for "${query}"`);
    }
  }

  // Video search (requires Serper API)
  async searchVideos(query, maxResults = 5) {
    try {
      if (this.serperApiKey) {
        const response = await fetch('https://google.serper.dev/videos', {
          method: 'POST',
          headers: {
            'X-API-KEY': this.serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            num: maxResults
          })
        });
        
        const data = await response.json();
        
        if (data.videos) {
          return data.videos.map(video => ({
            title: video.title,
            link: video.link,
            snippet: video.snippet,
            channel: video.channel,
            duration: video.duration,
            date: video.date,
            thumbnailUrl: video.thumbnailUrl
          }));
        }
      }
      
      // Fallback: Search YouTube via scraping-friendly endpoint
      return [{
        type: 'info',
        message: 'Video search requires SERPER_API_KEY configuration.',
        suggestion: `Search YouTube directly: https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      }];
    } catch (error) {
      console.error('Video search error:', error);
      throw new Error(`Video search failed for "${query}"`);
    }
  }

  // Advanced web search with filters
  async advancedWebSearch(query, options = {}) {
    const { timeRange, site, maxResults = 5 } = options;
    
    let searchQuery = query;
    
    if (site) {
      searchQuery += ` site:${site}`;
    }
    
    if (timeRange) {
      const timeFilters = {
        'day': 'qdr:d',
        'week': 'qdr:w',
        'month': 'qdr:m',
        'year': 'qdr:y'
      };
      // Note: Time filtering depends on API support
    }
    
    return this.search(searchQuery, maxResults);
  }
}

export default SearchService;
