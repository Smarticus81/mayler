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
                    "false_interruption_timeout": 1.0,
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
                    "false_interruption_timeout": 1.0,
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
