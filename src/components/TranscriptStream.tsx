import React from 'react';
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

    // Determine the "current" message to display
    // Priority: Interim (User/Agent) > Final (Agent) > Final (User)
    let activeMessage: { text: string; source: 'user' | 'agent' | 'system'; isInterim: boolean } | null = null;

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
            {/* We only render the active message. The CSS transitions handle the 'pop' effect if we key it properly, 
                 but for a simple fix to prevent overlap, we ensure only one div is 'active' at a time.
                 To enable true cross-fading, we would need a transition group, but CSS absolute positioning + opacity 
                 switching works well for 'zen' minimalism. */}

            {activeMessage && (
                <div key="active-message" className={`transcript active ${activeMessage.source} ${activeMessage.isInterim ? 'interim' : ''}`}>
                    <span className="transcript-text">{cleanText(activeMessage.text)}</span>
                </div>
            )}
        </div>
    );
};
