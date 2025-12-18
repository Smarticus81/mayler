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
    } = useMayler();

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript, interimTranscript, agentTranscript, agentInterimTranscript]);

    if (!connected) return null;

    return (
        <div className="transcript-area" ref={scrollRef}>
            {agentTranscript && (
                <div className="transcript agent">
                    <span className="transcript-text">{cleanText(agentTranscript)}</span>
                </div>
            )}
            {agentInterimTranscript && (
                <div className="transcript agent interim">
                    <span className="transcript-text">{cleanText(agentInterimTranscript)}</span>
                </div>
            )}
            {transcript && (
                <div className="transcript user">
                    <span className="transcript-text">{cleanText(transcript)}</span>
                </div>
            )}
            {interimTranscript && (
                <div className="transcript user interim">
                    <span className="transcript-text">{cleanText(interimTranscript)}</span>
                </div>
            )}
        </div>
    );
};
