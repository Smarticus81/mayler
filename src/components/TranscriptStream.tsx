import React, { useRef, useEffect } from 'react';
import { useMayler } from '../context/MaylerContext';
import { cleanText } from '../utils/stringUtils';

export const TranscriptStream: React.FC = () => {
    const {
        transcript,
        interimTranscript,
        agentTranscript,
        agentInterimTranscript,
        connected,
        speaking,
        chatHistory,
    } = useMayler();

    const historyEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll chat history to bottom
    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory.length]);

    // Current active message
    let activeMessage: { text: string; source: 'user' | 'agent'; isInterim: boolean } | null = null;

    if (agentInterimTranscript) {
        activeMessage = { text: agentInterimTranscript, source: 'agent', isInterim: true };
    } else if (interimTranscript) {
        activeMessage = { text: interimTranscript, source: 'user', isInterim: true };
    } else if (agentTranscript) {
        activeMessage = { text: agentTranscript, source: 'agent', isInterim: false };
    } else if (transcript) {
        activeMessage = { text: transcript, source: 'user', isInterim: false };
    }

    if (!connected) return null;

    return (
        <div className="transcript-area">
            {/* Chat history bubbles */}
            {chatHistory.length > 0 && (
                <div className="chat-history">
                    {chatHistory.slice(-12).map((msg) => (
                        <div key={msg.id} className={`chat-bubble ${msg.type}`}>
                            {cleanText(msg.text)}
                        </div>
                    ))}
                    <div ref={historyEndRef} />
                </div>
            )}

            {/* Current active transcript */}
            <div className="transcript-current">
                {activeMessage && (
                    <div className={`transcript active ${activeMessage.source} ${activeMessage.isInterim ? 'interim' : ''}`}>
                        <span className="transcript-text">{cleanText(activeMessage.text)}</span>
                    </div>
                )}

                {/* Typing indicator when agent is processing */}
                {speaking && !agentInterimTranscript && !agentTranscript && (
                    <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                    </div>
                )}
            </div>
        </div>
    );
};
