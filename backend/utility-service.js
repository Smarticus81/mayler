import fetch from 'node-fetch';

class UtilityService {
  constructor() {
    this.weatherApiKey = process.env.OPENWEATHER_API_KEY;
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  }

  // Weather using OpenWeatherMap API (free tier)
  async getWeather(location, units = 'fahrenheit') {
    try {
      const unitParam = units === 'celsius' ? 'metric' : 'imperial';

      if (this.weatherApiKey) {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${unitParam}&appid=${this.weatherApiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.cod !== 200) {
          throw new Error(data.message || 'Weather data not found');
        }

        return {
          location: data.name,
          country: data.sys?.country,
          temperature: Math.round(data.main.temp),
          feels_like: Math.round(data.main.feels_like),
          humidity: data.main.humidity,
          description: data.weather[0]?.description,
          wind_speed: data.wind?.speed,
          units: units === 'celsius' ? 'C' : 'F'
        };
      }

      // Fallback: use wttr.in (free, no API key)
      const wttrUrl = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
      const response = await fetch(wttrUrl);
      const data = await response.json();

      const current = data.current_condition[0];
      const temp = units === 'celsius' ? current.temp_C : current.temp_F;
      const feelsLike = units === 'celsius' ? current.FeelsLikeC : current.FeelsLikeF;

      return {
        location: data.nearest_area[0]?.areaName[0]?.value || location,
        country: data.nearest_area[0]?.country[0]?.value,
        temperature: parseInt(temp),
        feels_like: parseInt(feelsLike),
        humidity: parseInt(current.humidity),
        description: current.weatherDesc[0]?.value,
        wind_speed: current.windspeedMiles,
        units: units === 'celsius' ? 'C' : 'F'
      };
    } catch (error) {
      console.error('Weather fetch error:', error);
      throw new Error(`Could not get weather for ${location}: ${error.message}`);
    }
  }

  // Safe math expression calculator
  calculate(expression) {
    try {
      // Sanitize the expression - only allow numbers, operators, parentheses, and common math functions
      const sanitized = expression
        .replace(/[^0-9+\-*/().%^sqrt|sin|cos|tan|log|exp|abs|floor|ceil|round|pi|e\s]/gi, '')
        .replace(/\^/g, '**')
        .replace(/sqrt/gi, 'Math.sqrt')
        .replace(/sin/gi, 'Math.sin')
        .replace(/cos/gi, 'Math.cos')
        .replace(/tan/gi, 'Math.tan')
        .replace(/log/gi, 'Math.log10')
        .replace(/exp/gi, 'Math.exp')
        .replace(/abs/gi, 'Math.abs')
        .replace(/floor/gi, 'Math.floor')
        .replace(/ceil/gi, 'Math.ceil')
        .replace(/round/gi, 'Math.round')
        .replace(/\bpi\b/gi, 'Math.PI')
        .replace(/\be\b/gi, 'Math.E');

      // Use Function constructor for safer eval
      const result = new Function(`"use strict"; return (${sanitized})`)();

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result');
      }

      return {
        expression,
        result: Number.isInteger(result) ? result : parseFloat(result.toFixed(10))
      };
    } catch (error) {
      throw new Error(`Could not calculate: ${expression}`);
    }
  }

  // Unit conversion
  convertUnits(value, from, to) {
    const conversions = {
      // Length
      'meters_feet': (v) => v * 3.28084,
      'feet_meters': (v) => v / 3.28084,
      'km_miles': (v) => v * 0.621371,
      'miles_km': (v) => v / 0.621371,
      'inches_cm': (v) => v * 2.54,
      'cm_inches': (v) => v / 2.54,
      'yards_meters': (v) => v * 0.9144,
      'meters_yards': (v) => v / 0.9144,

      // Weight
      'kg_lbs': (v) => v * 2.20462,
      'lbs_kg': (v) => v / 2.20462,
      'kg_pounds': (v) => v * 2.20462,
      'pounds_kg': (v) => v / 2.20462,
      'grams_ounces': (v) => v * 0.035274,
      'ounces_grams': (v) => v / 0.035274,
      'oz_grams': (v) => v * 28.3495,
      'grams_oz': (v) => v / 28.3495,

      // Temperature
      'celsius_fahrenheit': (v) => (v * 9 / 5) + 32,
      'fahrenheit_celsius': (v) => (v - 32) * 5 / 9,
      'c_f': (v) => (v * 9 / 5) + 32,
      'f_c': (v) => (v - 32) * 5 / 9,
      'celsius_kelvin': (v) => v + 273.15,
      'kelvin_celsius': (v) => v - 273.15,

      // Volume
      'liters_gallons': (v) => v * 0.264172,
      'gallons_liters': (v) => v / 0.264172,
      'ml_oz': (v) => v * 0.033814,
      'oz_ml': (v) => v / 0.033814,
      'cups_ml': (v) => v * 236.588,
      'ml_cups': (v) => v / 236.588,

      // Speed
      'mph_kph': (v) => v * 1.60934,
      'kph_mph': (v) => v / 1.60934,
      'mps_mph': (v) => v * 2.23694,
      'mph_mps': (v) => v / 2.23694,

      // Area
      'sqft_sqm': (v) => v * 0.092903,
      'sqm_sqft': (v) => v / 0.092903,
      'acres_hectares': (v) => v * 0.404686,
      'hectares_acres': (v) => v / 0.404686,

      // Digital storage
      'mb_gb': (v) => v / 1024,
      'gb_mb': (v) => v * 1024,
      'gb_tb': (v) => v / 1024,
      'tb_gb': (v) => v * 1024,
      'kb_mb': (v) => v / 1024,
      'mb_kb': (v) => v * 1024,

      // Time
      'hours_minutes': (v) => v * 60,
      'minutes_hours': (v) => v / 60,
      'days_hours': (v) => v * 24,
      'hours_days': (v) => v / 24,
      'weeks_days': (v) => v * 7,
      'days_weeks': (v) => v / 7,
    };

    const fromNorm = from.toLowerCase().replace(/[^a-z]/g, '');
    const toNorm = to.toLowerCase().replace(/[^a-z]/g, '');
    const key = `${fromNorm}_${toNorm}`;

    if (conversions[key]) {
      const result = conversions[key](value);
      return {
        value,
        from,
        to,
        result: parseFloat(result.toFixed(6))
      };
    }

    throw new Error(`Conversion from ${from} to ${to} not supported`);
  }

  // Currency conversion using ExchangeRate API (free tier)
  async convertCurrency(amount, from, to) {
    try {
      const url = `https://api.exchangerate.host/convert?from=${from.toUpperCase()}&to=${to.toUpperCase()}&amount=${amount}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success && !data.result) {
        // Fallback API
        const fallbackUrl = `https://open.er-api.com/v6/latest/${from.toUpperCase()}`;
        const fallbackResp = await fetch(fallbackUrl);
        const fallbackData = await fallbackResp.json();

        if (fallbackData.rates && fallbackData.rates[to.toUpperCase()]) {
          const rate = fallbackData.rates[to.toUpperCase()];
          return {
            amount,
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            rate,
            result: parseFloat((amount * rate).toFixed(2))
          };
        }
        throw new Error('Currency conversion failed');
      }

      return {
        amount,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: data.info?.rate || (data.result / amount),
        result: parseFloat(data.result.toFixed(2))
      };
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw new Error(`Could not convert ${from} to ${to}`);
    }
  }

  // Stock price using Alpha Vantage or Yahoo Finance fallback
  async getStockPrice(symbol) {
    try {
      if (this.alphaVantageKey) {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${this.alphaVantageKey}`;
        const response = await fetch(url);
        const data = await response.json();

        const quote = data['Global Quote'];
        if (quote && quote['05. price']) {
          return {
            symbol: symbol.toUpperCase(),
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['09. change']),
            changePercent: quote['10. change percent'],
            high: parseFloat(quote['03. high']),
            low: parseFloat(quote['04. low']),
            volume: parseInt(quote['06. volume']),
            lastUpdated: quote['07. latest trading day']
          };
        }
      }

      // Fallback: Yahoo Finance API (unofficial)
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`;
      const response = await fetch(yahooUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await response.json();

      const result = data.chart?.result?.[0];
      if (result) {
        const meta = result.meta;
        const prevClose = meta.chartPreviousClose || meta.previousClose;
        const currentPrice = meta.regularMarketPrice;
        const change = currentPrice - prevClose;
        const changePercent = ((change / prevClose) * 100).toFixed(2);

        return {
          symbol: symbol.toUpperCase(),
          price: currentPrice,
          change: parseFloat(change.toFixed(2)),
          changePercent: `${changePercent}%`,
          high: meta.regularMarketDayHigh,
          low: meta.regularMarketDayLow,
          volume: meta.regularMarketVolume,
          currency: meta.currency
        };
      }

      throw new Error('Stock data not found');
    } catch (error) {
      console.error('Stock price error:', error);
      throw new Error(`Could not get stock price for ${symbol}`);
    }
  }

  // Crypto price using CoinGecko (free, no API key)
  async getCryptoPrice(symbol, currency = 'USD') {
    try {
      // Map common symbols to CoinGecko IDs
      const symbolMap = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'DOGE': 'dogecoin',
        'XRP': 'ripple',
        'ADA': 'cardano',
        'SOL': 'solana',
        'DOT': 'polkadot',
        'MATIC': 'matic-network',
        'LINK': 'chainlink',
        'UNI': 'uniswap',
        'AVAX': 'avalanche-2',
        'ATOM': 'cosmos',
        'LTC': 'litecoin',
        'BCH': 'bitcoin-cash',
        'SHIB': 'shiba-inu'
      };

      const coinId = symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
      const curr = currency.toLowerCase();

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${curr}&include_24hr_change=true&include_market_cap=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (data[coinId]) {
        const priceData = data[coinId];
        return {
          symbol: symbol.toUpperCase(),
          price: priceData[curr],
          change24h: priceData[`${curr}_24h_change`]?.toFixed(2) + '%',
          marketCap: priceData[`${curr}_market_cap`],
          currency: currency.toUpperCase()
        };
      }

      throw new Error('Cryptocurrency not found');
    } catch (error) {
      console.error('Crypto price error:', error);
      throw new Error(`Could not get crypto price for ${symbol}`);
    }
  }

  // Dictionary definition using Free Dictionary API
  async getDefinition(word) {
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Word not found');
      }

      const data = await response.json();
      const entry = data[0];

      const definitions = [];
      for (const meaning of entry.meanings.slice(0, 3)) {
        definitions.push({
          partOfSpeech: meaning.partOfSpeech,
          definition: meaning.definitions[0]?.definition,
          example: meaning.definitions[0]?.example,
          synonyms: meaning.synonyms?.slice(0, 5)
        });
      }

      return {
        word: entry.word,
        phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
        audio: entry.phonetics?.find(p => p.audio)?.audio,
        definitions
      };
    } catch (error) {
      console.error('Definition error:', error);
      throw new Error(`Could not find definition for "${word}"`);
    }
  }

  // Wikipedia search
  async wikipediaSearch(query, sentences = 3) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const response = await fetch(url);

      if (!response.ok) {
        // Try search API
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;
        const searchResp = await fetch(searchUrl);
        const searchData = await searchResp.json();

        if (searchData[1] && searchData[1][0]) {
          const exactUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchData[1][0])}`;
          const exactResp = await fetch(exactUrl);
          if (exactResp.ok) {
            const data = await exactResp.json();
            return {
              title: data.title,
              extract: data.extract,
              url: data.content_urls?.desktop?.page,
              thumbnail: data.thumbnail?.source
            };
          }
        }
        throw new Error('Article not found');
      }

      const data = await response.json();
      return {
        title: data.title,
        extract: data.extract,
        url: data.content_urls?.desktop?.page,
        thumbnail: data.thumbnail?.source
      };
    } catch (error) {
      console.error('Wikipedia search error:', error);
      throw new Error(`Could not find Wikipedia article for "${query}"`);
    }
  }

  // Time in timezone
  getTime(timezone = 'UTC') {
    try {
      // Normalize timezone input
      const tzMap = {
        'pst': 'America/Los_Angeles',
        'pacific': 'America/Los_Angeles',
        'est': 'America/New_York',
        'eastern': 'America/New_York',
        'cst': 'America/Chicago',
        'central': 'America/Chicago',
        'mst': 'America/Denver',
        'mountain': 'America/Denver',
        'gmt': 'Europe/London',
        'utc': 'UTC',
        'jst': 'Asia/Tokyo',
        'tokyo': 'Asia/Tokyo',
        'japan': 'Asia/Tokyo',
        'london': 'Europe/London',
        'paris': 'Europe/Paris',
        'berlin': 'Europe/Berlin',
        'sydney': 'Australia/Sydney',
        'dubai': 'Asia/Dubai',
        'singapore': 'Asia/Singapore',
        'hong kong': 'Asia/Hong_Kong',
        'mumbai': 'Asia/Kolkata',
        'india': 'Asia/Kolkata',
        'beijing': 'Asia/Shanghai',
        'china': 'Asia/Shanghai',
        'moscow': 'Europe/Moscow',
        'new york': 'America/New_York',
        'los angeles': 'America/Los_Angeles',
        'chicago': 'America/Chicago',
        'denver': 'America/Denver'
      };

      const tzInput = timezone ? timezone.toLowerCase() : 'utc';
      const tz = tzMap[tzInput] || timezone || 'UTC';

      const now = new Date();
      const options = {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const formatted = formatter.format(now);

      return {
        timezone: tz,
        datetime: formatted,
        iso: now.toLocaleString('en-US', { timeZone: tz }),
        timestamp: now.getTime()
      };
    } catch (error) {
      console.error('Time error:', error);
      throw new Error(`Could not get time for timezone: ${timezone}`);
    }
  }

  // Text translation using LibreTranslate (free) or fallback
  async translateText(text, targetLang, sourceLang = 'auto') {
    try {
      // Try LibreTranslate first
      const libreUrl = 'https://libretranslate.de/translate';
      const response = await fetch(libreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang === 'auto' ? 'auto' : sourceLang,
          target: targetLang,
          format: 'text'
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          originalText: text,
          translatedText: data.translatedText,
          sourceLang: data.detectedLanguage?.language || sourceLang,
          targetLang
        };
      }

      // Fallback: MyMemory API (free, limited)
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang === 'auto' ? 'autodetect' : sourceLang}|${targetLang}`;
      const mmResponse = await fetch(myMemoryUrl);
      const mmData = await mmResponse.json();

      if (mmData.responseStatus === 200) {
        return {
          originalText: text,
          translatedText: mmData.responseData.translatedText,
          sourceLang: sourceLang,
          targetLang
        };
      }

      throw new Error('Translation failed');
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Could not translate text to ${targetLang}`);
    }
  }

  // Timer (returns info - actual timer handled client-side or via notification)
  setTimer(duration, label = '') {
    const now = new Date();
    const endTime = new Date(now.getTime() + duration * 1000);

    return {
      duration,
      label,
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      message: `Timer set for ${this.formatDuration(duration)}${label ? `: ${label}` : ''}`
    };
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours} hours and ${mins} minutes` : `${hours} hours`;
  }

  // Create note (stored in memory - could integrate with note service)
  createNote(title, content) {
    const note = {
      id: Date.now().toString(),
      title: title || 'Untitled Note',
      content,
      createdAt: new Date().toISOString()
    };

    return {
      success: true,
      note,
      message: `Note created: "${note.title}"`
    };
  }
}

export default UtilityService;
