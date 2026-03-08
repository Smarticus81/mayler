import React, { useRef, useEffect, useCallback } from 'react';
import { useMayler } from '../context/MaylerContext';

interface VoiceOrbProps {
    audioLevel: number;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ audioLevel }) => {
    const { connected, loading, speaking, listening, resolvedTheme } = useMayler();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const phaseRef = useRef(0);
    const smoothLevelRef = useRef(0);

    const getOrbState = () => {
        if (loading) return 'loading';
        if (!connected) return 'idle';
        if (speaking) return 'speaking';
        if (listening) return 'listening';
        return 'connected';
    };

    const orbState = getOrbState();
    const isDark = resolvedTheme === 'dark';

    const drawFluidRing = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const size = canvas.offsetWidth;
        if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        ctx.clearRect(0, 0, size, size);

        smoothLevelRef.current += (audioLevel - smoothLevelRef.current) * 0.12;
        const level = smoothLevelRef.current;

        phaseRef.current += 0.015;
        const phase = phaseRef.current;
        const cx = size / 2;
        const cy = size / 2;
        const baseRadius = size * 0.38;

        const isActive = orbState === 'listening' || orbState === 'speaking';
        const ringCount = isActive ? 3 : 1;

        for (let ring = 0; ring < ringCount; ring++) {
            const ringOffset = ring * 6;
            const ringAlpha = isActive ? (0.3 - ring * 0.08) : 0.08;
            const points = 120;

            ctx.beginPath();

            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const noise1 = Math.sin(angle * 3 + phase + ringOffset) * (2 + level * 12);
                const noise2 = Math.sin(angle * 5 - phase * 1.3 + ringOffset) * (1.5 + level * 8);
                const noise3 = Math.sin(angle * 7 + phase * 0.7 + ringOffset) * (1 + level * 5);

                const r = baseRadius + ringOffset + noise1 + noise2 + noise3;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.closePath();

            const strokeGrad = ctx.createLinearGradient(0, 0, size, size);
            if (isDark) {
                strokeGrad.addColorStop(0, `rgba(184, 200, 175, ${ringAlpha})`);
                strokeGrad.addColorStop(1, `rgba(232, 196, 74, ${ringAlpha * 0.5})`);
            } else {
                strokeGrad.addColorStop(0, `rgba(168, 181, 160, ${ringAlpha})`);
                strokeGrad.addColorStop(1, `rgba(212, 175, 55, ${ringAlpha * 0.5})`);
            }

            ctx.strokeStyle = strokeGrad;
            ctx.lineWidth = isActive ? (1.5 + level * 2) : 1;
            ctx.stroke();
        }

        animationRef.current = requestAnimationFrame(drawFluidRing);
    }, [audioLevel, orbState, isDark]);

    useEffect(() => {
        drawFluidRing();
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [drawFluidRing]);

    return (
        <div className="orb-container">
            <canvas
                ref={canvasRef}
                className="orb-canvas"
                style={{ width: '100%', height: '100%' }}
            />

            {(orbState === 'listening' || orbState === 'speaking') && (
                <>
                    <div className="orb-ring pulse" />
                    <div className="orb-ring pulse" style={{ animationDelay: '0.8s' }} />
                </>
            )}

            <div
                className={`zen-orb ${orbState === 'listening' || orbState === 'speaking' ? 'listening' : ''} ${orbState === 'loading' ? 'loading' : ''}`}
                style={{
                    transform: `scale(${1 + smoothLevelRef.current * 0.2})`,
                }}
            >
                <div className="waveform-container">
                    <div className="waveform">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="wave-bar" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
