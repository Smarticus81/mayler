import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
    isActive: boolean;
    audioLevel?: number;
}

export const WaveformVisualizer = ({ isActive, audioLevel = 0 }: WaveformVisualizerProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const barsRef = useRef<number[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const resize = () => {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        resize();
        window.addEventListener('resize', resize);

        // Initialize bars
        const barCount = 32;
        if (barsRef.current.length === 0) {
            barsRef.current = Array(barCount).fill(0).map(() => Math.random() * 0.3);
        }

        const animate = () => {
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;
            const barWidth = width / barCount;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Update bars
            barsRef.current = barsRef.current.map((bar, i) => {
                if (isActive) {
                    // Active: responsive to audio
                    const target = 0.3 + (audioLevel * 0.7) + (Math.sin(Date.now() / 500 + i) * 0.2);
                    return bar + (target - bar) * 0.15;
                } else {
                    // Idle: gentle wave
                    const target = 0.2 + Math.sin(Date.now() / 1000 + i * 0.3) * 0.15;
                    return bar + (target - bar) * 0.1;
                }
            });

            // Draw bars
            barsRef.current.forEach((bar, i) => {
                const x = i * barWidth;
                const barHeight = bar * height;
                const y = (height - barHeight) / 2;

                // Gradient
                const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
                gradient.addColorStop(0, 'rgba(168, 181, 160, 0.8)');
                gradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.6)');
                gradient.addColorStop(1, 'rgba(168, 181, 160, 0.8)');

                ctx.fillStyle = gradient;
                ctx.fillRect(x + barWidth * 0.2, y, barWidth * 0.6, barHeight);

                // Glow effect
                if (isActive) {
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = 'rgba(168, 181, 160, 0.5)';
                }
            });

            ctx.shadowBlur = 0;
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resize);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive, audioLevel]);

    return (
        <canvas
            ref={canvasRef}
            className="waveform-visualizer"
            style={{ width: '100%', height: '100%' }}
        />
    );
};
