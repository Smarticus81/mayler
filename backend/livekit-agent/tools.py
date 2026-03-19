"""
Mayler Agent Tools — callable functions exposed to the LiveKit voice agent.
Each tool calls back to the Mayler Node.js backend API so existing services
(Gmail, Calendar, Search, Utilities, Vision, Browsing) are reused.
"""

import os
import json
import logging
import aiohttp
from livekit.agents import function_tool

logger = logging.getLogger("mayler-tools")

BACKEND_URL = os.getenv("MAYLER_BACKEND_URL", "http://localhost:3000")


async def _api(method: str, path: str, body: dict | None = None) -> dict:
    """Call the Mayler backend REST API."""
    url = f"{BACKEND_URL}{path}"
    async with aiohttp.ClientSession() as session:
        kwargs: dict = {"headers": {"Content-Type": "application/json"}}
        if body is not None:
            kwargs["json"] = body
        async with session.request(method, url, **kwargs) as resp:
            try:
                return await resp.json()
            except Exception:
                text = await resp.text()
                return {"error": text, "status": resp.status}


# ──────────────────────────────────────────────────────────────
# Gmail Tools
# ──────────────────────────────────────────────────────────────

@function_tool()
async def get_emails(max_results: int = 5) -> str:
    """Gets email list with metadata (id, subject, from, date, snippet).
    Returns up to max_results emails. Call again for next batch."""
    data = await _api("GET", f"/api/gmail/emails?maxResults={max_results}")
    return json.dumps(data)


@function_tool()
async def get_email_by_id(email_id: str) -> str:
    """Gets full email content by ID. Only use IDs returned by get_emails."""
    data = await _api("GET", f"/api/gmail/email/{email_id}")
    return json.dumps(data)


@function_tool()
async def search_emails(query: str, max_results: int = 5) -> str:
    """Searches emails in Gmail with a query string."""
    data = await _api("POST", "/api/gmail/search", {"query": query, "maxResults": max_results})
    return json.dumps(data)


@function_tool()
async def create_draft(to: str, subject: str, text: str, cc: str = "", bcc: str = "") -> str:
    """Creates and saves a draft email. Does NOT send it."""
    data = await _api("POST", "/api/gmail/drafts", {
        "to": to, "subject": subject, "text": text, "cc": cc, "bcc": bcc
    })
    return json.dumps(data)


@function_tool()
async def forward_email(email_id: str, to: str, text: str = "") -> str:
    """Forwards an email to another recipient."""
    data = await _api("POST", f"/api/gmail/forward/{email_id}", {"to": to, "text": text})
    return json.dumps(data)


@function_tool()
async def delete_email(email_id: str) -> str:
    """Deletes or trashes an email in Gmail."""
    data = await _api("POST", "/api/gmail/delete", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def mark_email_read(email_id: str) -> str:
    """Marks an email as read."""
    data = await _api("POST", "/api/gmail/mark-read", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def archive_email(email_id: str) -> str:
    """Archives an email (removes from Inbox)."""
    data = await _api("POST", "/api/gmail/archive", {"emailId": email_id})
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Calendar Tools
# ──────────────────────────────────────────────────────────────

@function_tool()
async def create_calendar_event(
    summary: str, start: str, end: str,
    description: str = "", location: str = ""
) -> str:
    """Creates a new event in the user's Google Calendar."""
    data = await _api("POST", "/api/calendar/events", {
        "summary": summary, "start": start, "end": end,
        "description": description, "location": location
    })
    return json.dumps(data)


@function_tool()
async def list_calendar_events(
    time_min: str = "", time_max: str = "",
    max_results: int = 10, query: str = ""
) -> str:
    """Lists upcoming events from the user's primary calendar."""
    params = []
    if time_min:
        params.append(f"timeMin={time_min}")
    if time_max:
        params.append(f"timeMax={time_max}")
    if max_results:
        params.append(f"maxResults={max_results}")
    if query:
        params.append(f"query={query}")
    qs = "&".join(params)
    data = await _api("GET", f"/api/calendar/events?{qs}")
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Web Search & Browsing Tools
# ──────────────────────────────────────────────────────────────

@function_tool()
async def web_search(query: str, max_results: int = 5) -> str:
    """Search the web for any information, news, or results."""
    data = await _api("POST", "/api/search", {"query": query, "maxResults": max_results})
    return json.dumps(data)


@function_tool()
async def deep_search(query: str, max_results: int = 8) -> str:
    """Performs a comprehensive deep internet search. Combines web search,
    news, and factual sources for thorough results on any topic."""
    results = {"web": [], "news": [], "facts": None}

    # Run parallel searches via backend
    web_data = await _api("POST", "/api/search", {"query": query, "maxResults": max_results})
    news_data = await _api("POST", "/api/news", {"category": query, "maxResults": 3})
    facts_data = await _api("POST", "/api/search/facts", {"query": query})

    results["web"] = web_data if isinstance(web_data, list) else web_data.get("results", [])
    results["news"] = news_data if isinstance(news_data, list) else news_data.get("articles", [])
    results["facts"] = facts_data

    return json.dumps(results)


@function_tool()
async def browse_url(url: str) -> str:
    """Fetches and extracts content from any URL. Returns title, description,
    main content, and links."""
    data = await _api("POST", "/api/browsing/browse-url", {"url": url})
    return json.dumps(data)


@function_tool()
async def get_news(topic: str, max_results: int = 5) -> str:
    """Retrieves latest news articles on a specific topic."""
    data = await _api("POST", "/api/news", {"category": topic, "maxResults": max_results})
    return json.dumps(data)


@function_tool()
async def search_images(query: str, max_results: int = 5) -> str:
    """Searches for images on the web."""
    data = await _api("POST", "/api/search/images", {"query": query, "maxResults": max_results})
    return json.dumps(data)


@function_tool()
async def search_videos(query: str, max_results: int = 5) -> str:
    """Searches for videos on YouTube or the web."""
    data = await _api("POST", "/api/search/videos", {"query": query, "maxResults": max_results})
    return json.dumps(data)


@function_tool()
async def wikipedia_search(query: str) -> str:
    """Search and retrieve summaries from Wikipedia."""
    data = await _api("POST", "/api/wikipedia", {"query": query})
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Utility Tools
# ──────────────────────────────────────────────────────────────

@function_tool()
async def get_weather(location: str, units: str = "metric") -> str:
    """Retrieves current weather for a location."""
    data = await _api("POST", "/api/weather", {"location": location, "units": units})
    return json.dumps(data)


@function_tool()
async def calculate(expression: str) -> str:
    """Performs mathematical calculations."""
    data = await _api("POST", "/api/calculate", {"expression": expression})
    return json.dumps(data)


@function_tool()
async def convert_currency(amount: float, from_currency: str, to_currency: str) -> str:
    """Converts an amount from one currency to another."""
    data = await _api("POST", "/api/currency", {
        "amount": amount, "from": from_currency, "to": to_currency
    })
    return json.dumps(data)


@function_tool()
async def translate_text(text: str, target_lang: str, source_lang: str = "") -> str:
    """Translates text to a target language."""
    body = {"text": text, "targetLanguage": target_lang}
    if source_lang:
        body["sourceLanguage"] = source_lang
    data = await _api("POST", "/api/translate", body)
    return json.dumps(data)


@function_tool()
async def get_stock_price(symbol: str) -> str:
    """Gets current stock price for a ticker symbol."""
    data = await _api("POST", "/api/stock", {"symbol": symbol})
    return json.dumps(data)


@function_tool()
async def get_crypto_price(symbol: str, currency: str = "usd") -> str:
    """Gets current cryptocurrency price."""
    data = await _api("POST", "/api/crypto", {"symbol": symbol, "currency": currency})
    return json.dumps(data)


@function_tool()
async def get_time(timezone: str = "") -> str:
    """Gets the current time, optionally in a specific timezone."""
    data = await _api("POST", "/api/time", {"timezone": timezone})
    return json.dumps(data)


@function_tool()
async def get_definition(word: str) -> str:
    """Gets the dictionary definition of a word."""
    data = await _api("POST", "/api/definition", {"word": word})
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Multi-modal Tools
# ──────────────────────────────────────────────────────────────

@function_tool()
async def analyze_image(image_description: str, query: str = "Describe what you see") -> str:
    """Analyzes an image that was shared or described by the user.
    For images sent via the LiveKit video track, the agent can see them directly.
    Use this for explicit image analysis requests."""
    data = await _api("POST", "/api/vision/analyze-documents", {
        "images": [],
        "query": f"[User described: {image_description}] {query}"
    })
    return json.dumps(data)


# Collect all tools for export
ALL_TOOLS = [
    get_emails, get_email_by_id, search_emails, create_draft,
    forward_email, delete_email, mark_email_read, archive_email,
    create_calendar_event, list_calendar_events,
    web_search, deep_search, browse_url, get_news,
    search_images, search_videos, wikipedia_search,
    get_weather, calculate, convert_currency, translate_text,
    get_stock_price, get_crypto_price, get_time, get_definition,
    analyze_image,
]
