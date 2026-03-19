"""
Mayler LiveKit Voice Agent — Production-grade voice AI with adaptive
interruption detection, low-latency pipeline, multi-modal capabilities,
and extensive tool access.

Run:  python agent.py dev       (development)
      python agent.py start     (production)
"""

import logging
import os
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.agents.voice import MetricsCollectedEvent
from livekit.plugins import openai, silero, deepgram, cartesia

from tools import ALL_TOOLS

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger("mayler-agent")
logger.setLevel(logging.INFO)

# ──────────────────────────────────────────────────────────────
# Agent Instructions
# ──────────────────────────────────────────────────────────────

MAYLER_INSTRUCTIONS = """You are Mayler, a professional email and productivity assistant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL SAFETY RULES - NEVER VIOLATE THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER send emails automatically - ONLY create drafts
2. ONLY use email IDs that appear in tool responses
3. NEVER guess, fabricate, or modify email IDs
4. Process emails continuously WITHOUT asking permission
5. NEVER ask "would you like me to continue" or "anything else"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL WORKFLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Call get_emails - returns metadata with 'id' field
2. For each email: call get_email_by_id with EXACT id
3. If it fails (404), SKIP IT - don't try other IDs
4. When batch is exhausted, call get_emails AGAIN for next batch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAPABILITIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Gmail: Read, search, draft, forward, archive, delete emails
- Calendar: Create, list, update, delete events
- Web Search: Search the web, news, images, videos, Wikipedia
- Deep Search: Comprehensive multi-source internet research
- Browsing: Read any URL and extract content
- Vision: Analyze images, documents, screenshots shared via video
- Utilities: Weather, calculator, currency, translation, stocks, crypto
- Multi-modal: Can see video/screen shares from the user

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALITY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Professional, warm, caring
- Enthusiastic and proactive
- Always respond in English
- Process tasks continuously without asking permission
- Concise but thorough responses

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TERMINATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- "goodbye"/"bye" → Say farewell and end
- "shut down"/"stop listening" → Say "Shutting down" and end
"""


# ──────────────────────────────────────────────────────────────
# Pipeline Configuration
# ──────────────────────────────────────────────────────────────

def _build_stt():
    """Select STT provider based on env config."""
    provider = os.getenv("LIVEKIT_STT_PROVIDER", "deepgram")
    if provider == "deepgram":
        return deepgram.STT(
            model="nova-3",
            language="en",
        )
    return openai.STT(model="gpt-4o-transcribe")


def _build_llm():
    """Select LLM provider."""
    model = os.getenv("LIVEKIT_LLM_MODEL", "gpt-4o")
    return openai.LLM(model=model, temperature=0.7)


def _build_tts():
    """Select TTS provider for lowest latency."""
    provider = os.getenv("LIVEKIT_TTS_PROVIDER", "openai")
    voice = os.getenv("LIVEKIT_TTS_VOICE", "ash")
    if provider == "cartesia":
        return cartesia.TTS(voice=voice)
    return openai.TTS(model="tts-1-hd", voice=voice)


def _build_realtime_model():
    """Build OpenAI Realtime model for ultra-low-latency mode."""
    voice = os.getenv("LIVEKIT_TTS_VOICE", "ash")
    return openai.realtime.RealtimeModel(
        model="gpt-4o-realtime-preview",
        voice=voice,
        temperature=0.7,
    )


# ──────────────────────────────────────────────────────────────
# Agent Entrypoint
# ──────────────────────────────────────────────────────────────

async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint — called when a user connects to a LiveKit room."""
    await ctx.connect()

    pipeline_mode = os.getenv("LIVEKIT_PIPELINE_MODE", "realtime")

    if pipeline_mode == "realtime":
        # ── Ultra-low-latency: OpenAI Realtime API ──
        # Single model handles STT + LLM + TTS with ~300ms latency
        logger.info("Starting Mayler agent in REALTIME mode (ultra-low latency)")
        session = AgentSession(
            llm=_build_realtime_model(),
            # Adaptive interruption detection
            allow_interruptions=True,
            min_interruption_duration=0.4,
            min_interruption_words=1,
            # False interruption recovery
            resume_false_interruption=True,
            false_interruption_timeout=2.0,
            # Endpointing tuned for conversational flow
            min_endpointing_delay=0.5,
            max_endpointing_delay=3.0,
        )
    else:
        # ── Pipeline mode: STT → LLM → TTS ──
        # More control over each stage, wider model selection
        logger.info("Starting Mayler agent in PIPELINE mode (STT → LLM → TTS)")

        # Try to import turn detector; fall back gracefully
        turn_detection: object = "server_vad"
        try:
            from livekit.plugins import turn_detector
            turn_detection = turn_detector.EOUModel()
            logger.info("Using LiveKit EOU turn detector (context-aware)")
        except ImportError:
            logger.info("Turn detector plugin not available, using server VAD")

        session = AgentSession(
            stt=_build_stt(),
            llm=_build_llm(),
            tts=_build_tts(),
            turn_detection=turn_detection,
            # Adaptive interruption detection
            allow_interruptions=True,
            min_interruption_duration=0.4,
            min_interruption_words=1,
            # False interruption recovery
            resume_false_interruption=True,
            false_interruption_timeout=2.0,
            # Endpointing for natural conversation
            min_endpointing_delay=0.5,
            max_endpointing_delay=3.0,
        )

    # Log voice pipeline metrics for observability
    @session.on("metrics_collected")
    def _on_metrics(ev: MetricsCollectedEvent):
        agents.metrics.log_metrics(ev.metrics)

    # Start the agent with all tools and multi-modal input
    await session.start(
        room=ctx.room,
        agent=Agent(
            instructions=MAYLER_INSTRUCTIONS,
            tools=ALL_TOOLS,
        ),
        room_input_options=RoomInputOptions(
            # Enable video input for multi-modal (screen share, camera)
            video_enabled=True,
            # Enable audio with noise cancellation
            audio_enabled=True,
        ),
    )

    # Greet the user (generate_reply lets the LLM craft a natural greeting)
    await session.generate_reply(
        instructions="Greet the user warmly. Introduce yourself as Mayler, their email and productivity assistant. Offer to help with emails, calendar, web search, or anything else."
    )


# ──────────────────────────────────────────────────────────────
# Worker Setup
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            # Agent type for LiveKit Cloud dispatch
            agent_name="mayler-voice-agent",
        )
    )
