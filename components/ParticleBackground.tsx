"use client";

import { useEffect, useRef } from "react";

interface Neuron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  opacity: number;
  pulsePhase: number;
  layer: number; // 0 = back, 1 = mid, 2 = front
}

const COLORS = {
  cyan: "#00e5ff",
  purple: "#8b5cf6",
  pink: "#ec4899",
  emerald: "#10b981",
};

const NEURON_COUNT = 100;
const CONNECTION_DISTANCE = 160;
const MOUSE_INFLUENCE_DISTANCE = 200;
const SPEED = 0.25;

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const neurons = useRef<Neuron[]>([]);
  const animationId = useRef<number>(0);
  const mouse = useRef({ x: -1000, y: -1000 });
  const time = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize neurons in different layers
    const colorKeys = Object.keys(COLORS) as (keyof typeof COLORS)[];
    neurons.current = Array.from({ length: NEURON_COUNT }, (_, i) => {
      const layer = i % 3;
      const baseRadius = layer === 0 ? 1 : layer === 1 ? 1.5 : 2;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * SPEED * (1 + layer * 0.3),
        vy: (Math.random() - 0.5) * SPEED * (1 + layer * 0.3),
        radius: baseRadius,
        baseRadius,
        color: COLORS[colorKeys[Math.floor(Math.random() * colorKeys.length)]],
        opacity: 0.3 + layer * 0.2,
        pulsePhase: Math.random() * Math.PI * 2,
        layer,
      };
    });

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouse.current.x = -1000;
      mouse.current.y = -1000;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      time.current += 0.016; // ~60fps
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pts = neurons.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      // Update positions and pulse
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;

        // Pulse effect
        p.radius = p.baseRadius + Math.sin(time.current * 2 + p.pulsePhase) * 0.3;

        // Mouse attraction/repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_INFLUENCE_DISTANCE && dist > 0) {
          const force = (MOUSE_INFLUENCE_DISTANCE - dist) / MOUSE_INFLUENCE_DISTANCE;
          p.vx += (dx / dist) * force * 0.02;
          p.vy += (dy / dist) * force * 0.02;
        }

        // Speed limit
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > SPEED * 2) {
          p.vx = (p.vx / speed) * SPEED * 2;
          p.vy = (p.vy / speed) * SPEED * 2;
        }
      }

      // Sort by layer for proper depth rendering
      const sortedPts = [...pts].sort((a, b) => a.layer - b.layer);

      // Draw connections (synapses)
      for (let i = 0; i < sortedPts.length; i++) {
        for (let j = i + 1; j < sortedPts.length; j++) {
          const p1 = sortedPts[i];
          const p2 = sortedPts[j];

          // Only connect neurons in same or adjacent layers
          if (Math.abs(p1.layer - p2.layer) > 1) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const layerDistance = CONNECTION_DISTANCE * (1 + (p1.layer + p2.layer) * 0.1);

          if (dist < layerDistance) {
            const alpha = (1 - dist / layerDistance) * 0.15 * ((p1.layer + p2.layer) / 4 + 0.5);

            // Gradient line for synapse effect
            const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            gradient.addColorStop(0, p1.color);
            gradient.addColorStop(1, p2.color);

            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 0.5 + (p1.layer + p2.layer) * 0.15;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw mouse connections (active synapses)
      if (mx > 0 && my > 0) {
        for (const p of sortedPts) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOUSE_INFLUENCE_DISTANCE) {
            const alpha = (1 - dist / MOUSE_INFLUENCE_DISTANCE) * 0.4;

            // Pulsing glow effect
            const pulse = Math.sin(time.current * 5 + dist * 0.02) * 0.5 + 0.5;

            ctx.beginPath();
            ctx.strokeStyle = COLORS.pink;
            ctx.globalAlpha = alpha * pulse;
            ctx.lineWidth = 1 + pulse;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mx, my);
            ctx.stroke();
          }
        }

        // Draw mouse glow
        const mouseGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 50);
        mouseGlow.addColorStop(0, "rgba(236, 72, 153, 0.3)");
        mouseGlow.addColorStop(1, "rgba(236, 72, 153, 0)");
        ctx.globalAlpha = 0.5 + Math.sin(time.current * 3) * 0.2;
        ctx.fillStyle = mouseGlow;
        ctx.beginPath();
        ctx.arc(mx, my, 50, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw neurons with glow
      for (const p of sortedPts) {
        // Outer glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
        glow.addColorStop(0, p.color);
        glow.addColorStop(1, "transparent");

        ctx.globalAlpha = p.opacity * 0.3;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.globalAlpha = p.opacity * 1.5;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}
