import { useState } from 'react';
import { WaveformVisualizer } from './WaveformVisualizer';
import { ParticleField } from './ParticleField';

interface StreamingVisualProps {
    isActive: boolean;
    audioLevel?: number;
}

export const StreamingVisual = ({ isActive, audioLevel }: StreamingVisualProps) => {
    const [mode, setMode] = useState<'waveform' | 'particles' | 'orb'>('orb');

    const cycleMode = () => {
        setMode(current => {
            if (current === 'orb') return 'waveform';
            if (current === 'waveform') return 'particles';
            return 'orb';
        });
    };

    return (
        <div className="streaming-visual-container">
            {mode === 'waveform' && (
                <div className="visual-mode">
                    <WaveformVisualizer isActive={isActive} audioLevel={audioLevel} />
                </div>
            )}

            {mode === 'particles' && (
                <div className="visual-mode">
                    <ParticleField isActive={isActive} />
                </div>
            )}

            {mode === 'orb' && (
                <div className="visual-mode orb-mode">
                    {/* Orb is rendered by parent component */}
                </div>
            )}

            <button
                className="mode-toggle-btn"
                onClick={cycleMode}
                title={`Switch to ${mode === 'orb' ? 'waveform' : mode === 'waveform' ? 'particles' : 'orb'}`}
            >
                {mode === 'orb' && '〰️'}
                {mode === 'waveform' && '✨'}
                {mode === 'particles' && '⭕'}
            </button>
        </div>
    );
};
