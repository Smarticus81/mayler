"""
Mayler LiveKit Voice Agent — Production-grade voice AI with adaptive
interruption detection, low-latency pipeline, multi-modal capabilities,
and extensive tool access.

Run:  python agent.py console    (local testing)
      python agent.py dev        (development with hot-reload)
      python agent.py start      (production)
"""

import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    TurnHandlingOptions,
    cli,
    inference,
    metrics,
)
from livekit.agents.llm import function_tool
from livekit.agents.voice import MetricsCollectedEvent
from livekit.plugins import silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from tools import ALL_TOOLS

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger("mayler-agent")
logger.setLevel(logging.INFO)

# ──────────────────────────────────────────────────────────────
# Agent Instructions
# ──────────────────────────────────────────────────────────────

MAYLER_INSTRUCTIONS = """You are Mayler, a professional email and productivity assistant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL SAFETY RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER send emails automatically — ONLY create drafts unless the user
   explicitly says "send it"
2. ONLY use email/draft IDs returned by tool responses — NEVER fabricate IDs
3. If a tool call returns an error or 404, SKIP that item and move on

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GMAIL CONNECTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the user asks to connect their email or any email tool returns
"Gmail not authenticated":
1. Call check_gmail_connection to get the auth URL
2. Tell the user: "I have a link to connect your Gmail. You can open
   the settings panel and connect from there, or I can give you the
   direct link." Then read out the auth URL.
3. After they connect, continue the conversation normally — do NOT
   disconnect or restart the session.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL READING — PAGINATION WORKFLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is the EXACT procedure for reading through emails. Follow it
precisely every time:

STEP 1: Call get_emails(max_results=5) → returns {"emails": [...], "nextPageToken": "..."}
STEP 2: You now have a list of emails with their IDs. Present the
        subjects/senders to the user.
STEP 3: For each email the user wants to hear, call get_email_by_id
        with the EXACT id from the list. Read out the relevant content.
STEP 4: When the user says "next email" or "continue", move to the
        NEXT email in your current list. Do NOT call get_emails again.
STEP 5: When you've gone through ALL emails in the current batch AND
        the user wants more, THEN call get_emails again WITH the
        page_token from the previous response to get the next page.

KEY RULES FOR EMAIL ITERATION:
- Keep track of which emails you've already read from the current batch
- "Next email" means the next unread email in your current list
- Only fetch a new page when the current page is exhausted
- If get_email_by_id fails for one email, skip it and try the next
- When the user asks "read my emails" or "go through my emails", start
  with get_emails, then read each one sequentially
- Always tell the user which email number they're on (e.g., "Email 3 of 5")

EXAMPLE FLOW:
User: "Read my emails"
→ Call get_emails(max_results=5) → gets 5 emails + nextPageToken
→ "You have 5 emails. Email 1 of 5 is from John about 'Meeting Tomorrow'"
→ Call get_email_by_id(id_of_email_1) → read the content
User: "Next"
→ "Email 2 of 5 is from Sarah about 'Project Update'"
→ Call get_email_by_id(id_of_email_2) → read the content
User: "Next"
→ (continue through 3, 4, 5)
User: "Next"
→ "That was the last email in this batch. Let me get more."
→ Call get_emails(max_results=5, page_token=saved_token)
→ "Here are 5 more emails. Email 1 of 5 is from..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL ACTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can perform these actions on any email using its ID:
- Reply: reply_to_email — creates a threaded reply
- Forward: forward_email — forwards to another recipient
- Draft: create_draft — compose a new draft
- Star/Unstar: star_email, unstar_email
- Read/Unread: mark_email_read, mark_email_unread
- Archive: archive_email — removes from inbox, keeps in All Mail
- Delete: delete_email — moves to trash
- Important: mark_email_important
- Spam: mark_email_spam

Draft management:
- list_drafts — see all saved drafts
- send_draft — send a previously created draft
- update_draft — modify a draft
- delete_draft — remove a draft

When the user asks you to reply or respond to an email, ask what they
want to say, compose it, and use reply_to_email. Confirm what you wrote.

When the user asks to draft a new email, gather the recipient, subject,
and body, then call create_draft.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEARCH:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use search_emails for specific queries. You can also use the query
parameter in get_emails for filtered inbox views:
- "is:unread" — only unread emails
- "from:someone@gmail.com" — from a specific sender
- "newer_than:1d" — today's emails
- "has:attachment" — emails with attachments
- "subject:invoice" — emails about invoices

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OTHER CAPABILITIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Calendar: Create, list, update, delete events
- Web Search: Search the web, news, images, videos, Wikipedia
- Deep Search: Comprehensive multi-source internet research
- Browsing: Read any URL and extract content
- Vision: Analyze images, documents, screenshots shared via video
- Utilities: Weather, calculator, currency, translation, stocks, crypto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALITY & BEHAVIOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Professional, warm, and caring
- Concise — keep responses brief for voice
- Proactive — when reading emails, keep going without asking
  "would you like me to continue?" Just say "Moving on to the next one"
- Always respond in English
- When summarizing emails, focus on: who sent it, the subject, and
  the key point in 1-2 sentences

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TERMINATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- "goodbye"/"bye" → Say farewell and end
- "shut down"/"stop listening" → Say "Shutting down" and end
"""


# ──────────────────────────────────────────────────────────────
# Mayler Agent class with on_enter greeting
# ──────────────────────────────────────────────────────────────

class MaylerAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=MAYLER_INSTRUCTIONS,
            tools=ALL_TOOLS,
        )

    async def on_enter(self) -> None:
        """Called when the agent enters the session — greet the user."""
        self.session.generate_reply(
            instructions="Greet the user warmly. Introduce yourself as Mayler, "
            "their email and productivity assistant. Offer to help with emails, "
            "calendar, web search, or anything else. Keep it brief and natural."
        )


# ──────────────────────────────────────────────────────────────
# Server & Entrypoint
# ──────────────────────────────────────────────────────────────

server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    """Pre-load VAD model at process startup for fast cold-start."""
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    """Main entrypoint — called when a user connects to a LiveKit room."""
    ctx.log_context_fields = {"room": ctx.room.name}

    pipeline_mode = os.getenv("LIVEKIT_PIPELINE_MODE", "pipeline")

    # Select STT provider
    stt_provider = os.getenv("LIVEKIT_STT_PROVIDER", "deepgram")
    if stt_provider == "deepgram":
        stt = inference.STT("deepgram/nova-3", language="multi")
    else:
        stt = inference.STT("openai/gpt-4o-transcribe")

    # Select LLM
    llm_model = os.getenv("LIVEKIT_LLM_MODEL", "openai/gpt-4.1-mini")
    llm = inference.LLM(llm_model)

    # Select TTS provider and voice
    tts_provider = os.getenv("LIVEKIT_TTS_PROVIDER", "cartesia")
    tts_voice = os.getenv("LIVEKIT_TTS_VOICE", "")
    if tts_provider == "cartesia":
        tts = inference.TTS("cartesia/sonic-3", voice=tts_voice) if tts_voice else inference.TTS("cartesia/sonic-3")
    elif tts_provider == "elevenlabs":
        tts = inference.TTS("elevenlabs/eleven_turbo_v2", voice=tts_voice) if tts_voice else inference.TTS("elevenlabs/eleven_turbo_v2")
    else:
        tts = inference.TTS("openai/tts-1-hd", voice=tts_voice or "ash")

    if pipeline_mode == "realtime":
        # Ultra-low-latency: OpenAI Realtime API (speech-to-speech)
        logger.info("Starting Mayler agent in REALTIME mode")
        from livekit.plugins import openai as openai_plugin
        realtime_voice = os.getenv("LIVEKIT_TTS_VOICE", "ash")
        session = AgentSession(
            llm=openai_plugin.realtime.RealtimeModel(
                model="gpt-4o-realtime-preview",
                voice=realtime_voice,
                temperature=0.7,
            ),
            vad=ctx.proc.userdata["vad"],
            turn_handling=TurnHandlingOptions(
                turn_detection=MultilingualModel(),
                interruption={
                    "resume_false_interruption": True,
                    "false_interruption_timeout": 0.5,
                },
            ),
        )
    else:
        # Pipeline mode: STT → LLM → TTS (more control, wider model choice)
        logger.info("Starting Mayler agent in PIPELINE mode (STT → LLM → TTS)")
        session = AgentSession(
            stt=stt,
            llm=llm,
            tts=tts,
            vad=ctx.proc.userdata["vad"],
            turn_handling=TurnHandlingOptions(
                turn_detection=MultilingualModel(),
                interruption={
                    "resume_false_interruption": True,
                    "false_interruption_timeout": 0.5,
                },
            ),
            preemptive_generation=True,
        )

    # Log voice pipeline metrics for observability
    @session.on("metrics_collected")
    def _on_metrics(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)

    # Start the agent session
    await session.start(
        agent=MaylerAgent(),
        room=ctx.room,
    )


# ──────────────────────────────────────────────────────────────
# Launch
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cli.run_app(server)
