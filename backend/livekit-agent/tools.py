"""
Mayler Agent Tools — callable functions exposed to the LiveKit voice agent.
Each tool calls back to the Mayler Node.js backend API so existing services
(Gmail, Calendar, Search, Utilities, Vision, Browsing) are reused.
"""

import os
import json
import logging
import aiohttp
from livekit.agents.llm import function_tool

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
# Gmail — Connection & Auth
# ──────────────────────────────────────────────────────────────

@function_tool()
async def check_gmail_connection() -> str:
    """Checks if Gmail is connected and authenticated. Returns connection
    status and an auth URL if not connected. Call this before any email
    operation if the user hasn't connected Gmail yet."""
    data = await _api("GET", "/api/gmail/auth-status")
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Gmail — Reading & Listing
# ──────────────────────────────────────────────────────────────

@function_tool()
async def get_emails(
    max_results: int = 5,
    page_token: str = "",
    query: str = "in:inbox"
) -> str:
    """Gets a page of emails with metadata (id, subject, from, date, snippet).
    Returns emails and a nextPageToken for fetching the next page.

    Args:
        max_results: Number of emails to fetch (1-20).
        page_token: Token from a previous get_emails response to get the NEXT page.
                    Leave empty for the first page.
        query: Gmail search query. Default 'in:inbox'. Examples:
               'is:unread', 'from:someone@gmail.com', 'subject:invoice',
               'in:inbox is:unread', 'newer_than:1d', 'has:attachment'.
    """
    params = f"maxResults={max_results}&query={query}"
    if page_token:
        params += f"&pageToken={page_token}"
    data = await _api("GET", f"/api/gmail/emails?{params}")
    return json.dumps(data)


@function_tool()
async def get_email_by_id(email_id: str) -> str:
    """Gets full email content by ID. Only use IDs returned by get_emails
    or search_emails. Returns subject, from, to, date, body, attachments.
    If it returns 404 or error, skip this email and move to the next one."""
    data = await _api("GET", f"/api/gmail/email/{email_id}")
    return json.dumps(data)


@function_tool()
async def search_emails(query: str, max_results: int = 5) -> str:
    """Searches emails using Gmail search syntax. Returns matching emails
    with metadata. Use Gmail query operators:
    - from:user@example.com
    - to:user@example.com
    - subject:keyword
    - is:unread / is:starred / is:important
    - has:attachment
    - newer_than:7d / older_than:1m
    - label:INBOX / label:SENT
    - filename:pdf
    Combine operators: 'from:boss@work.com is:unread newer_than:3d'"""
    data = await _api("POST", "/api/gmail/search", {
        "query": query, "maxResults": max_results
    })
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Gmail — Composing & Drafts
# ──────────────────────────────────────────────────────────────

@function_tool()
async def create_draft(
    to: str, subject: str, text: str,
    cc: str = "", bcc: str = ""
) -> str:
    """Creates and saves a draft email. Does NOT send it.
    The user must review and send manually."""
    data = await _api("POST", "/api/gmail/drafts", {
        "to": to, "subject": subject, "text": text,
        "cc": cc, "bcc": bcc
    })
    return json.dumps(data)


@function_tool()
async def reply_to_email(email_id: str, text: str) -> str:
    """Creates a reply to an existing email. Uses the original email's
    thread and subject. Only use IDs from get_emails/search_emails."""
    data = await _api("POST", f"/api/gmail/reply/{email_id}", {
        "text": text
    })
    return json.dumps(data)


@function_tool()
async def forward_email(email_id: str, to: str, text: str = "") -> str:
    """Forwards an email to another recipient with optional additional text."""
    data = await _api("POST", f"/api/gmail/forward/{email_id}", {
        "to": to, "text": text
    })
    return json.dumps(data)


@function_tool()
async def list_drafts(max_results: int = 5) -> str:
    """Lists saved draft emails."""
    data = await _api("GET", f"/api/gmail/drafts?maxResults={max_results}")
    return json.dumps(data)


@function_tool()
async def send_draft(draft_id: str) -> str:
    """Sends an existing draft by its ID. The draft must already exist."""
    data = await _api("POST", f"/api/gmail/drafts/{draft_id}/send", {})
    return json.dumps(data)


@function_tool()
async def update_draft(
    draft_id: str, to: str = "", subject: str = "",
    text: str = "", cc: str = "", bcc: str = ""
) -> str:
    """Updates an existing draft with new content."""
    body = {}
    if to:
        body["to"] = to
    if subject:
        body["subject"] = subject
    if text:
        body["text"] = text
    if cc:
        body["cc"] = cc
    if bcc:
        body["bcc"] = bcc
    data = await _api("PUT", f"/api/gmail/drafts/{draft_id}", body)
    return json.dumps(data)


@function_tool()
async def delete_draft(draft_id: str) -> str:
    """Deletes a draft email."""
    data = await _api("DELETE", f"/api/gmail/drafts/{draft_id}")
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Gmail — Organization & Labels
# ──────────────────────────────────────────────────────────────

@function_tool()
async def mark_email_read(email_id: str) -> str:
    """Marks an email as read."""
    data = await _api("POST", "/api/gmail/mark-read", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def mark_email_unread(email_id: str) -> str:
    """Marks an email as unread."""
    data = await _api("POST", "/api/gmail/mark-unread", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def star_email(email_id: str) -> str:
    """Stars an email to mark it as important."""
    data = await _api("POST", "/api/gmail/star", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def unstar_email(email_id: str) -> str:
    """Removes the star from an email."""
    data = await _api("POST", "/api/gmail/unstar", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def archive_email(email_id: str) -> str:
    """Archives an email (removes from Inbox but keeps in All Mail)."""
    data = await _api("POST", "/api/gmail/archive", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def delete_email(email_id: str) -> str:
    """Moves an email to Trash."""
    data = await _api("POST", "/api/gmail/delete", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def mark_email_important(email_id: str) -> str:
    """Marks an email as important."""
    data = await _api("POST", "/api/gmail/mark-important", {"emailId": email_id})
    return json.dumps(data)


@function_tool()
async def mark_email_spam(email_id: str) -> str:
    """Marks an email as spam and removes it from inbox."""
    data = await _api("POST", "/api/gmail/mark-spam", {"emailId": email_id})
    return json.dumps(data)


# ──────────────────────────────────────────────────────────────
# Gmail — Summarize
# ──────────────────────────────────────────────────────────────

@function_tool()
async def summarize_emails(max_results: int = 10) -> str:
    """Gets a quick summary/snippets of recent inbox emails."""
    data = await _api("POST", "/api/gmail/summarize", {"maxResults": max_results})
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
    data = await _api("POST", "/api/search", {
        "query": query, "maxResults": max_results
    })
    return json.dumps(data)


@function_tool()
async def deep_search(query: str, max_results: int = 8) -> str:
    """Performs a comprehensive deep internet search. Combines web search,
    news, and factual sources for thorough results on any topic."""
    results = {"web": [], "news": [], "facts": None}

    web_data = await _api("POST", "/api/search", {
        "query": query, "maxResults": max_results
    })
    news_data = await _api("POST", "/api/news", {
        "category": query, "maxResults": 3
    })
    facts_data = await _api("POST", "/api/search/facts", {"query": query})

    results["web"] = (
        web_data if isinstance(web_data, list)
        else web_data.get("results", [])
    )
    results["news"] = (
        news_data if isinstance(news_data, list)
        else news_data.get("articles", [])
    )
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
    data = await _api("POST", "/api/news", {
        "category": topic, "maxResults": max_results
    })
    return json.dumps(data)


@function_tool()
async def search_images(query: str, max_results: int = 5) -> str:
    """Searches for images on the web."""
    data = await _api("POST", "/api/search/images", {
        "query": query, "maxResults": max_results
    })
    return json.dumps(data)


@function_tool()
async def search_videos(query: str, max_results: int = 5) -> str:
    """Searches for videos on YouTube or the web."""
    data = await _api("POST", "/api/search/videos", {
        "query": query, "maxResults": max_results
    })
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
    data = await _api("POST", "/api/weather", {
        "location": location, "units": units
    })
    return json.dumps(data)


@function_tool()
async def calculate(expression: str) -> str:
    """Performs mathematical calculations."""
    data = await _api("POST", "/api/calculate", {"expression": expression})
    return json.dumps(data)


@function_tool()
async def convert_currency(
    amount: float, from_currency: str, to_currency: str
) -> str:
    """Converts an amount from one currency to another."""
    data = await _api("POST", "/api/currency", {
        "amount": amount, "from": from_currency, "to": to_currency
    })
    return json.dumps(data)


@function_tool()
async def translate_text(
    text: str, target_lang: str, source_lang: str = ""
) -> str:
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
    data = await _api("POST", "/api/crypto", {
        "symbol": symbol, "currency": currency
    })
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
async def analyze_image(
    image_description: str, query: str = "Describe what you see"
) -> str:
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
    # Gmail — Auth
    check_gmail_connection,
    # Gmail — Reading
    get_emails, get_email_by_id, search_emails, summarize_emails,
    # Gmail — Composing
    create_draft, reply_to_email, forward_email,
    list_drafts, send_draft, update_draft, delete_draft,
    # Gmail — Organization
    mark_email_read, mark_email_unread, star_email, unstar_email,
    archive_email, delete_email, mark_email_important, mark_email_spam,
    # Calendar
    create_calendar_event, list_calendar_events,
    # Search & Browsing
    web_search, deep_search, browse_url, get_news,
    search_images, search_videos, wikipedia_search,
    # Utilities
    get_weather, calculate, convert_currency, translate_text,
    get_stock_price, get_crypto_price, get_time, get_definition,
    # Multi-modal
    analyze_image,
]
