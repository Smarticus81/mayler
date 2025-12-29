import { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
}

interface ParticleFieldProps {
    isActive: boolean;
    particleCount?: number;
}

export const ParticleField = ({ isActive, particleCount = 50 }: ParticleFieldProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: 0, y: 0 });

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

        // Initialize particles
        if (particlesRef.current.length === 0) {
            particlesRef.current = Array(particleCount).fill(null).map(() => ({
                x: Math.random() * canvas.offsetWidth,
                y: Math.random() * canvas.offsetHeight,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.3
            }));
        }

        // Mouse tracking
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };
        canvas.addEventListener('mousemove', handleMouseMove);

        const animate = () => {
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;

            // Clear with fade effect
            ctx.fillStyle = 'rgba(245, 245, 240, 0.1)';
            ctx.fillRect(0, 0, width, height);

            // Update and draw particles
            particlesRef.current.forEach((particle, i) => {
                // Update position
                particle.x += particle.vx;
                particle.y += particle.vy;

                // Bounce off edges
                if (particle.x < 0 || particle.x > width) particle.vx *= -1;
                if (particle.y < 0 || particle.y > height) particle.vy *= -1;

                // Mouse interaction when active
                if (isActive) {
                    const dx = mouseRef.current.x - particle.x;
                    const dy = mouseRef.current.y - particle.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 100) {
                        particle.vx -= dx / dist * 0.05;
                        particle.vy -= dy / dist * 0.05;
                    }
                }

                // Damping
                particle.vx *= 0.99;
                particle.vy *= 0.99;

                // Draw particle
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(168, 181, 160, ${particle.opacity})`;
                ctx.fill();

                // Draw connections
                particlesRef.current.forEach((other, j) => {
                    if (i >= j) return;

                    const dx = particle.x - other.x;
                    const dy = particle.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(particle.x, particle.y);
                        ctx.lineTo(other.x, other.y);
                        ctx.strokeStyle = `rgba(168, 181, 160, ${0.2 * (1 - dist / 100)})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                });

                // Glow when active
                if (isActive) {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = 'rgba(212, 175, 55, 0.5)';
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(212, 175, 55, ${particle.opacity * 0.3})`;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('mousemove', handleMouseMove);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive, particleCount]);

    return (
        <canvas
            ref={canvasRef}
            className="particle-field"
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        />
    );
};
