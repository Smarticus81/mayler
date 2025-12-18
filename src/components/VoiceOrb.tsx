import React from 'react';
import { useMayler } from '../context/MaylerContext';

interface VoiceOrbProps {
    audioLevel: number;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ audioLevel }) => {
    const { connected, loading, speaking, listening } = useMayler();

    const getOrbState = () => {
        if (loading) return 'loading';
        if (!connected) return 'idle';
        if (speaking) return 'speaking';
        if (listening) return 'listening';
        return 'connected';
    };

    const orbState = getOrbState();

    return (
        <div className="orb-container">
            <div
                className={`zen-orb ${orbState === 'listening' || orbState === 'speaking' ? 'listening' : ''}`}
                style={{
                    transform: `scale(${1 + audioLevel * 0.3})`,
                }}
            >
                <div className="waveform-container">
                    <div className="waveform">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="wave-bar"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
