import React, { useState, useRef, useEffect, useCallback } from 'react';

// Type declarations
declare global {
  interface Window {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEvent) => unknown) | null;
  onend: ((ev: Event) => unknown) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => unknown) | null;
  onstart?: ((ev: Event) => unknown) | null;
  start(): void;
  stop(): void;
}
type SRConstructor = new () => SpeechRecognition;

// Similarity functions
const levenshtein = (a: string, b: string) => {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

const similarity = (a: string, b: string) => {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length) || 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
};

const WAKE_WORDS = ['mayler', 'may-ler', 'may ler', 'hey mayler', 'hey may-ler', 'mailer', 'maler'];
const TERMINATION_WORDS = ['goodbye', 'stop listening', 'that\'s all', 'thank you mayler', 'thanks mayler', 'bye mayler'];
const SHUTDOWN_WORDS = ['shutdown', 'shut down', 'turn off'];
const wakeThreshold = 0.4; // Lowered for better detection
const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

// Smooth transcript display
const TranscriptDisplay: React.FC<{
  text: string;
  type: 'user' | 'agent' | 'system';
  isInterim?: boolean;
}> = ({ text, type, isInterim }) => {
  return (
    <div className={`transcript ${type} ${isInterim ? 'interim' : ''}`}>
      <span className="transcript-text">{text}</span>
    </div>
  );
};

type ChatMessage = {
  id: string;
  type: 'user' | 'agent' | 'system';
  text: string;
};

type JSONObject = Record<string, unknown>;

const asObject = (v: unknown): JSONObject | null => (v && typeof v === 'object' ? (v as JSONObject) : null);
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const WebRTCApp: React.FC = () => {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [_audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState(''); // latest user final
  const [interimTranscript, setInterimTranscript] = useState(''); // latest user interim
  const [agentTranscript, setAgentTranscript] = useState(''); // latest agent final
  const [agentInterimTranscript, setAgentInterimTranscript] = useState(''); // latest agent interim
  const [_messages, setMessages] = useState<ChatMessage[]>([]);

  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioHint, setShowAudioHint] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('alloy');
  const [isWakeMode, setIsWakeMode] = useState(true); // true = wake word mode, false = command mode

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const listeningRef = useRef(false);
  const wakeWordEnabledRef = useRef(true);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteLevelIntervalRef = useRef<number | null>(null);
  const micLevelIntervalRef = useRef<number | null>(null);
  const functionArgsByCallIdRef = useRef<Map<string, string>>(new Map());
  const activeResponseIdRef = useRef<string | null>(null);
  const shouldGreetOnConnectRef = useRef<boolean>(false);

  // Update refs when state changes
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    wakeWordEnabledRef.current = wakeWordEnabled;
  }, [wakeWordEnabled]);

  const recognizerRef = useRef<SpeechRecognition | null>(null);
  const wakeRunningRef = useRef<boolean>(false);

  // Initialize Audio Context
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try {
      // Let the browser choose the best sample rate for the device
      audioContextRef.current = new Ctx();
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
    }
    return () => {
      audioContextRef.current?.close().catch(() => { });
    };
  }, []);

  // Check Google Status
  const checkGoogleStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        setGoogleStatus(data.gmail ? 'available' : 'unavailable');
      }
    } catch {
      setGoogleStatus('unknown');
    }
  }, []);

  // PWA-compatible OAuth trigger - defined before useEffect
  const triggerGoogleAuth = useCallback(async () => {
    console.log('[OAuth] triggerGoogleAuth called');
    try {
      console.log('[OAuth] Fetching auth URL from /api/gmail/auth-url');
      const response = await fetch('/api/gmail/auth-url');
      const data = await response.json();
      console.log('[OAuth] Response:', { ok: response.ok, status: response.status, data });

      if (!response.ok) {
        console.error('Failed to get auth URL:', data);
        setError(data.error || 'Failed to initiate Google authentication');
        return;
      }

      if (data.authUrl) {
        console.log('[OAuth] Opening popup with URL:', data.authUrl);
        // Open in a new window/tab
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          data.authUrl,
          'Google Authentication',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
        );
        console.log('[OAuth] Popup opened:', popup);
      } else {
        console.error('[OAuth] No authUrl in response');
      }
    } catch (error) {
      console.error('Error triggering Google auth:', error);
      setError('Failed to initiate Google authentication');
    }
  }, []);

  // Handle OAuth callback - now defined after triggerGoogleAuth
  useEffect(() => {
    const initAuth = async () => {
      await checkGoogleStatus();

      // Handle OAuth callback for PWA
      const urlParams = new URLSearchParams(window.location.search);
      const authSuccess = urlParams.get('auth_success');
      if (authSuccess === 'true') {
        setGoogleStatus('available');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // Automatically open OAuth window on first load if not authenticated
        const status = await fetch('/api/gmail/status').then(r => r.json()).catch(() => ({ authenticated: false }));
        if (!status.authenticated) {
          triggerGoogleAuth();
        }
      }
    };

    initAuth();
  }, [checkGoogleStatus, triggerGoogleAuth]);

  const pushMessage = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const next = [...prev, { ...msg, id }];
      return next.length > 8 ? next.slice(next.length - 8) : next;
    });
  }, []);

  const clearConversation = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setAgentTranscript('');
    setAgentInterimTranscript('');
    setMessages([]);
    activeResponseIdRef.current = null;
    functionArgsByCallIdRef.current.clear();
  }, []);

  const sendEvent = useCallback((event: JSONObject) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') return;
    dcRef.current.send(JSON.stringify(event));
  }, []);

  const runTool = useCallback(async (name: string, args: unknown) => {
    const a = asObject(args) ?? {};
    const safeJson = async (resp: Response) => {
      const text = await resp.text().catch(() => '');
      try {
        return JSON.parse(text);
      } catch {
        return { ok: resp.ok, status: resp.status, body: text };
      }
    };

    switch (name) {
      case 'google_auth_setup': {
        const resp = await fetch('/api/gmail/auth-url');
        const data = await safeJson(resp);

        if (resp.ok && data.authUrl) {
          // Open in a new window/tab
          const width = 600;
          const height = 700;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;

          window.open(
            data.authUrl,
            'Google Authentication',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
          );

          return {
            success: true,
            message: 'Opening Google authentication window. Please complete the authorization process.'
          };
        }

        return data;
      }
      case 'create_calendar_event': {
        const resp = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a),
        });
        return await safeJson(resp);
      }
      case 'list_calendar_events': {
        const params = new URLSearchParams();
        if (a.timeMin) params.set('timeMin', String(a.timeMin));
        if (a.timeMax) params.set('timeMax', String(a.timeMax));
        if (a.maxResults != null) params.set('maxResults', String(a.maxResults));
        if (a.query) params.set('query', String(a.query));
        const resp = await fetch(`/api/calendar/events?${params.toString()}`);
        return await safeJson(resp);
      }
      case 'get_emails': {
        const maxResults = (a.maxResults as number | undefined) ?? 5;
        const resp = await fetch(`/api/gmail/emails?maxResults=${encodeURIComponent(String(maxResults))}`);
        return await safeJson(resp);
      }
      case 'search_emails': {
        const resp = await fetch('/api/gmail/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: a.query, maxResults: (a.maxResults as number | undefined) ?? 5 }),
        });
        return await safeJson(resp);
      }
      case 'send_email': {
        const resp = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a),
        });
        return await safeJson(resp);
      }
      case 'web_search': {
        const resp = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: a.query, maxResults: (a.maxResults as number | undefined) ?? 5 }),
        });
        return await safeJson(resp);
      }
      case 'get_weather': {
        const resp = await fetch('/api/weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: a.location, units: a.units }),
        });
        return await safeJson(resp);
      }
      case 'calculate': {
        const resp = await fetch('/api/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expression: a.expression }),
        });
        return await safeJson(resp);
      }
      case 'get_stock_price': {
        const resp = await fetch('/api/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: a.symbol }),
        });
        return await safeJson(resp);
      }
      case 'get_crypto_price': {
        const resp = await fetch('/api/crypto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: a.symbol, currency: a.currency }),
        });
        return await safeJson(resp);
      }
      case 'get_definition': {
        const resp = await fetch('/api/definition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: a.word }),
        });
        return await safeJson(resp);
      }
      case 'wikipedia_search': {
        const resp = await fetch('/api/wikipedia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: a.query }),
        });
        return await safeJson(resp);
      }
      case 'convert_units': {
        const resp = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: a.value, from: a.from, to: a.to }),
        });
        return await safeJson(resp);
      }
      case 'get_time': {
        const resp = await fetch('/api/time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone: a.timezone }),
        });
        return await safeJson(resp);
      }
      case 'set_reminder': {
        const resp = await fetch('/api/calendar/action-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionItem: a.title,
            dueDate: a.dateTime,
            priority: a.priority ?? 'medium',
          }),
        });
        return await safeJson(resp);
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }, []);

  const handleFunctionCall = useCallback(async (call_id: string, name: string, rawArgs: unknown) => {
    let args: unknown = rawArgs;
    if (typeof rawArgs === 'string') {
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = { raw: rawArgs };
      }
    }

    const result = await runTool(name, args);

    // Trigger OAuth window when AI calls google_auth_setup
    if (name === 'google_auth_setup') {
      triggerGoogleAuth();
    }

    sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: JSON.stringify(result),
      },
    });
    sendEvent({ type: 'response.create' });
  }, [runTool, sendEvent, triggerGoogleAuth]);

  const configureSession = useCallback(() => {
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: `You are mayler, a laid-back but professional AI assistant. You're calm, collected, and genuinely helpful without being overly enthusiastic. Think of yourself as a knowledgeable friend who happens to be really good at getting things done. You speak naturally, use casual language when appropriate, but maintain professionalism when handling important tasks. You don't use excessive exclamation points or overly cheerful language. You're confident, direct, and occasionally have a dry sense of humor. When helping with tasks, you're thorough but not verbose.

IMPORTANT LISTENING BEHAVIOR:
- When the user says "goodbye", "stop listening", "that's all", "thank you mayler", "thanks mayler", or "bye mayler", acknowledge briefly and then the system will return to wake word mode.
- If the user says "shutdown", "shut down", or "turn off", acknowledge that you're shutting down completely.
- Stay in continuous listening mode - don't end the conversation unless the user explicitly uses one of the termination phrases above.`,
        output_modalities: ['audio'],
        audio: {
          input: {
            transcription: { model: 'gpt-4o-mini-transcribe' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 600,
            },
          },
          output: {
            voice: selectedVoice,
          },
        },
        tools: [
          { type: 'function', name: 'google_auth_setup', description: 'Opens an OAuth window for the user to authenticate with Google, granting access to Gmail and Calendar. Call this when the user wants to connect their Google account. The window will open automatically.', parameters: { type: 'object', properties: {} } },
          {
            type: 'function',
            name: 'create_calendar_event',
            description: "Creates a new event in the user's Google Calendar.",
            parameters: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: 'Title of the event' },
                description: { type: 'string', description: 'Description or details of the event' },
                start: { type: 'string', description: 'Start time in ISO 8601 format' },
                end: { type: 'string', description: 'End time in ISO 8601 format' },
                location: { type: 'string', description: 'Location of the event' },
                attendees: { type: 'array', items: { type: 'string' }, description: 'List of email addresses to invite' },
              },
              required: ['summary', 'start', 'end'],
            },
          },
          {
            type: 'function',
            name: 'list_calendar_events',
            description: "Lists upcoming events from the user's calendar.",
            parameters: {
              type: 'object',
              properties: {
                maxResults: { type: 'number', description: 'Maximum number of events to return (default 10)' },
                timeMin: { type: 'string', description: 'Start time to list events from (ISO 8601)' },
                timeMax: { type: 'string', description: 'End time to list events to (ISO 8601)' },
                query: { type: 'string', description: 'Free text search terms to filter events' },
              },
            },
          },
          { type: 'function', name: 'get_emails', description: "Retrieves recent emails from the user's Gmail inbox.", parameters: { type: 'object', properties: { maxResults: { type: 'number' } } } },
          {
            type: 'function',
            name: 'search_emails',
            description: 'Searches emails in Gmail with a query.',
            parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] },
          },
          {
            type: 'function',
            name: 'send_email',
            description: 'Sends an email via Gmail.',
            parameters: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, text: { type: 'string' }, cc: { type: 'string' }, bcc: { type: 'string' } }, required: ['to', 'subject', 'text'] },
          },
          { type: 'function', name: 'web_search', description: 'Searches the web for information.', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } },
          { type: 'function', name: 'get_weather', description: 'Gets current weather for a location.', parameters: { type: 'object', properties: { location: { type: 'string' }, units: { type: 'string' } }, required: ['location'] } },
          { type: 'function', name: 'calculate', description: 'Performs mathematical calculations.', parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } },
          { type: 'function', name: 'get_stock_price', description: 'Gets current stock price and change.', parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
          { type: 'function', name: 'get_crypto_price', description: 'Gets current cryptocurrency price.', parameters: { type: 'object', properties: { symbol: { type: 'string' }, currency: { type: 'string' } }, required: ['symbol'] } },
          { type: 'function', name: 'get_definition', description: 'Gets the dictionary definition of a word.', parameters: { type: 'object', properties: { word: { type: 'string' } }, required: ['word'] } },
          { type: 'function', name: 'wikipedia_search', description: 'Searches Wikipedia for information on a topic.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
          { type: 'function', name: 'convert_units', description: 'Converts between units of measurement.', parameters: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] } },
          { type: 'function', name: 'get_time', description: 'Gets current time in a specific timezone.', parameters: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] } },
          { type: 'function', name: 'set_reminder', description: 'Creates a reminder as a calendar event.', parameters: { type: 'object', properties: { title: { type: 'string' }, dateTime: { type: 'string' }, priority: { type: 'string' } }, required: ['title', 'dateTime'] } },
        ],
      },
    });
  }, [sendEvent, selectedVoice]);

  const startRemoteAudioLevelMeter = useCallback(() => {
    if (!remoteStreamRef.current) return;
    if (remoteLevelIntervalRef.current) {
      clearInterval(remoteLevelIntervalRef.current);
      remoteLevelIntervalRef.current = null;
    }

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      remoteAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(remoteStreamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      remoteAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      remoteLevelIntervalRef.current = window.setInterval(() => {
        if (!remoteAnalyserRef.current) return;
        if (!speaking) return;
        remoteAnalyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(avg / 128, 1));
      }, 50);
    } catch (error) {
      console.error('Failed to start remote audio level meter:', error);
    }
  }, [speaking]);

  const stopRemoteAudioLevelMeter = useCallback(() => {
    if (remoteLevelIntervalRef.current) {
      clearInterval(remoteLevelIntervalRef.current);
      remoteLevelIntervalRef.current = null;
    }
    remoteAnalyserRef.current = null;
    if (remoteAudioCtxRef.current) {
      remoteAudioCtxRef.current.close().catch(() => { });
      remoteAudioCtxRef.current = null;
    }
  }, []);

  const connectToOpenAIRealtime = useCallback(async () => {
    if (connected || loading) return;
    setLoading(true);
    setError('');
    clearConversation();

    try {
      const tokenResp = await fetch('/api/token', { method: 'POST' });
      const tokenJson = (await tokenResp.json().catch(() => null)) as unknown;
      const tokenData = asObject(tokenJson);

      // Robustly handle the ephemeral token structure
      // OpenAI typically returns { client_secret: { value: "...", ... } }
      // But example doc showed { value: "..." }
      let token: string | null = null;
      if (tokenData) {
        const clientSecret = asObject(tokenData.client_secret);
        token = clientSecret ? asString(clientSecret.value) : asString(tokenData.value);
      }

      if (!tokenResp.ok || !token) {
        const errMsg = tokenData ? asString(tokenData.error) : null;
        throw new Error(errMsg || 'Failed to get realtime token');
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        configureSession();
        if (shouldGreetOnConnectRef.current) {
          shouldGreetOnConnectRef.current = false;
          // Wait for session to be configured before greeting
          setTimeout(() => {
            // Safety check: ensure data channel is still open
            if (dcRef.current && dcRef.current.readyState === 'open') {
              sendEvent({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{ type: 'input_text', text: 'Hey mayler' }],
                },
              });
              sendEvent({ type: 'response.create' });
            }
          }, 500);
        }
      };

      dc.onmessage = (event) => {
        let msg: JSONObject | null = null;
        try {
          msg = asObject(JSON.parse(event.data) as unknown);
        } catch {
          /* noop */
          return;
        }
        if (!msg) return;

        const t = asString(msg.type);
        if (!t) return;

        if (t === 'error') {
          const errObj = asObject(msg.error);
          const errMsg = (errObj && asString(errObj.message)) || asString(msg.message) || 'Realtime error';
          setError(errMsg);
          pushMessage({ type: 'system', text: errMsg });
          return;
        }

        // Server VAD / turn events
        if (t === 'input_audio_buffer.speech_started') {
          if (speaking) {
            sendEvent({ type: 'response.cancel' });
          }
          setListening(true);
          return;
        }
        if (t === 'input_audio_buffer.speech_stopped') {
          setListening(false);
          // Server VAD automatically triggers response, no need to send response.create
          return;
        }

        // Response lifecycle
        if (t === 'response.created') {
          const respObj = asObject(msg.response);
          activeResponseIdRef.current = (respObj && asString(respObj.id)) || asString(msg.response_id) || null;
          setLoading(false);
          return;
        }
        if (t === 'response.done') {
          activeResponseIdRef.current = null;
          setAgentInterimTranscript('');
          setSpeaking(false);
          stopRemoteAudioLevelMeter();
          setAudioLevel(0);
          return;
        }

        // Agent transcripts (text/audio transcript)
        if (t === 'response.audio_transcript.delta' || t === 'response.text.delta') {
          const delta = asString(msg.delta) || asString(msg.text) || '';
          if (delta) {
            setAgentInterimTranscript((prev) => prev + delta);
          }
          return;
        }
        if (t === 'response.audio_transcript.done' || t === 'response.text.done') {
          const text = asString(msg.text) || asString(msg.transcript) || '';
          if (text.trim()) {
            setAgentTranscript(text);
            pushMessage({ type: 'agent', text });
          }
          setAgentInterimTranscript('');
          return;
        }

        // User transcription
        if (t === 'input_audio_transcription.delta') {
          const delta = asString(msg.delta) || '';
          if (delta) {
            setInterimTranscript((prev) => prev + delta);
          }
          return;
        }
        if (t === 'input_audio_transcription.completed' || t === 'conversation.item.input_audio_transcription.completed') {
          const text = asString(msg.transcript) || asString(msg.text) || '';
          if (text.trim()) {
            setTranscript(text);
            pushMessage({ type: 'user', text });
          }
          setInterimTranscript('');
          return;
        }

        // Function calling (handle multiple event shapes)
        if (t === 'response.function_call_arguments.delta') {
          const callId = asString(msg.call_id);
          const delta = asString(msg.delta);
          if (callId && delta != null) {
            const prev = functionArgsByCallIdRef.current.get(callId) || '';
            functionArgsByCallIdRef.current.set(callId, prev + delta);
          }
          return;
        }
        if (t === 'response.output_item.added') {
          const item = asObject(msg.item);
          if (item && asString(item.type) === 'function_call') {
            const callId = asString(item.call_id);
            const args = asString(item.arguments) || '';
            if (callId) functionArgsByCallIdRef.current.set(callId, args);
          }
          return;
        }
        if (t === 'response.output_item.done' || t === 'conversation.item.created') {
          const item = asObject(msg.item);
          const itemType = item ? asString(item.type) : null;
          if (item && (itemType === 'function_call' || itemType === 'tool_call')) {
            const callId = asString(item.call_id) || asString(item.id);
            const name = asString(item.name);
            const args = item.arguments ?? (callId ? functionArgsByCallIdRef.current.get(callId) : undefined) ?? {};
            if (callId && name) handleFunctionCall(callId, name, args);
          }
          return;
        }
      };

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (!stream) return;
        remoteStreamRef.current = stream;
        if (remoteAudioElRef.current) {
          remoteAudioElRef.current.srcObject = stream;
          const playPromise = remoteAudioElRef.current.play();
          if (playPromise && typeof (playPromise as Promise<void>).catch === 'function') {
            (playPromise as Promise<void>).catch(() => {
              setShowAudioHint(true);
            });
          }
        }
      };

      // Mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Local mic level meter for orb when listening
      if (audioContextRef.current) {
        try {
          const micSource = audioContextRef.current.createMediaStreamSource(stream);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          micSource.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const id = window.setInterval(() => {
            if (!listeningRef.current || speaking) return;
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(avg / 128, 1));
          }, 50);
          micLevelIntervalRef.current = id;
        } catch (error) {
          console.error('Failed to start mic level meter:', error);
        }
      }

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      // Using /v1/realtime/calls without model param since it's in the token
      const answerResp = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp || '',
      });
      const answerSdp = await answerResp.text();
      if (!answerResp.ok) {
        throw new Error(answerSdp || 'Failed to establish realtime connection');
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setConnected(true);
      setLoading(false);
      setListening(true);
      pushMessage({ type: 'system', text: 'Connected' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Failed to connect');
      pushMessage({ type: 'system', text: msg || 'Failed to connect' });
      setLoading(false);
      setConnected(false);
      setListening(false);
    }
  }, [connected, loading, clearConversation, configureSession, sendEvent, pushMessage, handleFunctionCall, speaking, stopRemoteAudioLevelMeter]);

  const disconnectFromOpenAIRealtime = useCallback(() => {
    try {
      if (dcRef.current) {
        try { dcRef.current.close(); } catch { /* noop */ }
        dcRef.current = null;
      }
      if (pcRef.current) {
        if (micLevelIntervalRef.current) {
          clearInterval(micLevelIntervalRef.current);
          micLevelIntervalRef.current = null;
        }
        try { pcRef.current.close(); } catch { /* noop */ }
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (remoteAudioElRef.current) {
        remoteAudioElRef.current.srcObject = null;
      }
      remoteStreamRef.current = null;
      stopRemoteAudioLevelMeter();
      setSpeaking(false);
      setListening(false);
      setConnected(false);
      setLoading(false);
      setAudioLevel(0);
    } finally {
      // keep conversation visible after disconnect
    }
  }, [stopRemoteAudioLevelMeter]);

  // Wake Word Logic
  const detectWakeWord = useCallback((transcript: string) => {
    const lower = sanitize(transcript);
    for (const word of WAKE_WORDS) {
      if (lower.includes(word) || similarity(lower, word) > wakeThreshold) {
        return true;
      }
    }
    return false;
  }, []);

  const detectTerminationWord = useCallback((transcript: string) => {
    const lower = sanitize(transcript);
    for (const word of TERMINATION_WORDS) {
      if (lower.includes(word) || similarity(lower, word) > 0.7) {
        console.log(`Termination word detected: "${transcript}" matched "${word}"`);
        return true;
      }
    }
    return false;
  }, []);

  const detectShutdownWord = useCallback((transcript: string) => {
    const lower = sanitize(transcript);
    for (const word of SHUTDOWN_WORDS) {
      if (lower.includes(word) || similarity(lower, word) > 0.7) {
        console.log(`Shutdown word detected: "${transcript}" matched "${word}"`);
        return true;
      }
    }
    return false;
  }, []);

  const handleStartListening = useCallback(async () => {
    // Resume audio context if suspended (browser autoplay policy)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        setShowAudioHint(false);
      } catch (e) {
        console.error('Failed to resume audio context:', e);
        setShowAudioHint(true);
      }
    }

    shouldGreetOnConnectRef.current = true;
    connectToOpenAIRealtime();
  }, [connectToOpenAIRealtime]);

  const stopWakeRecognition = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    wakeRunningRef.current = false;
  }, []);

  const startWakeRecognition = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Speech recognition not supported');
      return;
    }

    if (wakeRunningRef.current || recognizerRef.current) return;

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const results = event.results;
        const idx = event.resultIndex;
        const transcript = results[idx][0].transcript;
        const isFinal = results[idx].isFinal;

        if (isFinal || results[idx][0].confidence > 0.7) {
          if (detectWakeWord(transcript)) {
            stopWakeRecognition();
            handleStartListening();
          }
        }
      };

      recognition.onend = () => {
        wakeRunningRef.current = false;
        recognizerRef.current = null;
        // Check refs instead of captured state to avoid stale closures
        if (wakeWordEnabledRef.current && !listeningRef.current) {
          setTimeout(() => startWakeRecognition(), 1000);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Wake word error:', event.error);
        wakeRunningRef.current = false;
      };

      recognition.start();
      recognizerRef.current = recognition;
      wakeRunningRef.current = true;
    } catch (e) {
      console.error('Failed to start wake recognition:', e);
    }
  }, [detectWakeWord, handleStartListening, stopWakeRecognition]);

  const handleStopListening = useCallback(() => {
    disconnectFromOpenAIRealtime();
    if (wakeWordEnabled) {
      startWakeRecognition();
    }
  }, [disconnectFromOpenAIRealtime, wakeWordEnabled, startWakeRecognition]);

  // Manage wake word recognition state
  useEffect(() => {
    if (wakeWordEnabled && !listening && !loading && !connected) {
      startWakeRecognition();
    } else {
      stopWakeRecognition();
    }
  }, [wakeWordEnabled, listening, loading, connected, startWakeRecognition, stopWakeRecognition]);

  // Determine state
  let orbState: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';
  if (loading) orbState = 'thinking';
  else if (speaking) orbState = 'speaking';
  else if (listening) orbState = 'listening';

  return (
    <div className="mayler-container">
      {/* Ambient background */}
      <div className="ambient-bg" />
      <div className="glass-overlay" />

      {/* Status indicator */}
      <div className="status-bar">
        {showAudioHint && (
          <div className="audio-hint" onClick={() => {
            if (audioContextRef.current) {
              audioContextRef.current.resume();
              setShowAudioHint(false);
            }
          }}>
            Tap to enable audio
          </div>
        )}
        <div className={`status-indicator ${connected ? 'connected' : ''}`}>
          <span className="status-dot" />
          <span className="status-text">{connected ? 'Connected' : 'Ready'}</span>
        </div>
        <button
          className="settings-btn"
          onClick={() => {
            console.log('[Settings] Button clicked, current showSettings:', showSettings);
            setShowSettings(!showSettings);
            console.log('[Settings] Setting showSettings to:', !showSettings);
          }}
          aria-label="Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-content">
            <h3>Settings</h3>

            <div className="setting-item">
              <span>Wake Word Detection</span>
              <button
                className={`toggle-btn ${wakeWordEnabled ? 'active' : ''}`}
                onClick={() => {
                  const next = !wakeWordEnabled;
                  setWakeWordEnabled(next);
                  if (next && !listening) startWakeRecognition();
                  else stopWakeRecognition();
                }}
              >
                {wakeWordEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="setting-item">
              <span>Voice Style</span>
              <select
                className="voice-select"
                value={selectedVoice}
                onChange={(e) => {
                  const newVoice = e.target.value as typeof selectedVoice;
                  setSelectedVoice(newVoice);
                  // Reconfigure session with new voice if connected
                  if (connected) {
                    configureSession();
                  }
                }}
              >
                <option value="alloy">Alloy - Balanced and neutral</option>
                <option value="echo">Echo - Warm and friendly</option>
                <option value="fable">Fable - Expressive and dynamic</option>
                <option value="onyx">Onyx - Deep and authoritative</option>
                <option value="nova">Nova - Bright and energetic</option>
                <option value="shimmer">Shimmer - Soft and gentle</option>
              </select>
            </div>

            <div className="setting-item">
              <span>Google Account</span>
              <button
                className={`toggle-btn ${googleStatus === 'available' ? 'active' : ''}`}
                onClick={() => {
                  console.log('[Button] Google Account Connect button clicked');
                  triggerGoogleAuth();
                }}
              >
                {googleStatus === 'available' ? 'Connected' : 'Connect'}
              </button>
            </div>

            <button className="close-settings" onClick={() => setShowSettings(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="main-content">
        {/* Logo/Name */}
        <div className="brand">
          <h1 className="brand-name">mayler</h1>
        </div>

        {/* Orb visualization */}
        <div className="orb-container">
          <div className={`zen-orb ${orbState === 'listening' || orbState === 'speaking' ? 'listening' : ''}`}>
            <div className="waveform-container">
              <div className="waveform">
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript area */}
        <div className="transcript-area">
          {(() => {
            const cleanText = (text: string) => {
              let cleaned = text.replace(/https?:\/\/[^\s]+/g, '[link]');
              if (cleaned.length > 150) {
                cleaned = cleaned.substring(0, 150) + '...';
              }
              return cleaned;
            };

            if (error) {
              const errorMsg = error.includes('http') ? 'Connection error. Please try again.' : error;
              return <TranscriptDisplay text={cleanText(errorMsg)} type="system" />;
            }
            if (agentInterimTranscript) {
              return <TranscriptDisplay text={cleanText(agentInterimTranscript)} type="agent" isInterim />;
            }
            if (agentTranscript) {
              return <TranscriptDisplay text={cleanText(agentTranscript)} type="agent" />;
            }
            if (interimTranscript) {
              return <TranscriptDisplay text={cleanText(interimTranscript)} type="user" isInterim />;
            }
            if (transcript) {
              return <TranscriptDisplay text={cleanText(transcript)} type="user" />;
            }
            return (
              <TranscriptDisplay
                text={
                  listening
                    ? "Listening..."
                    : speaking
                      ? "Speaking..."
                      : loading
                        ? "Connecting..."
                        : connected
                          ? "Ready"
                          : "Tap to start"
                }
                type="system"
              />
            );
          })()}
        </div>
      </main>

      {/* Control bar */}
      <div className="control-bar">
        {!listening ? (
          <button
            className="main-btn"
            onClick={handleStartListening}
            disabled={loading}
            aria-label="Start conversation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        ) : (
          <button
            className="main-btn active"
            onClick={handleStopListening}
            aria-label="Stop conversation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
      </div>

      {/* Remote audio element (OpenAI realtime output) */}
      <audio
        ref={remoteAudioElRef}
        autoPlay
        playsInline
        onPlay={() => {
          setSpeaking(true);
          startRemoteAudioLevelMeter();
        }}
        onEnded={() => {
          setSpeaking(false);
          stopRemoteAudioLevelMeter();
          setAudioLevel(0);
        }}
      />
    </div>
  );
};

export default WebRTCApp;