"use client";

import { useEffect, useState } from "react";

interface Props {
  score: number;
  max: number;
  color: string;
  /** Anima a partir do zero ao montar. */
  animate?: boolean;
  size?: number;
}

const RADIUS = 86;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreGauge({
  score,
  max,
  color,
  animate = true,
  size = 220,
}: Props) {
  const [display, setDisplay] = useState(animate ? 0 : score);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!animate || prefersReducedMotion) {
      setDisplay(score);
      return;
    }
    const duration = 1100;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Number((score * eased).toFixed(2)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, animate]);

  const ratio = max > 0 ? Math.min(Math.max(display / max, 0), 1) : 0;
  const offset = CIRCUMFERENCE * (1 - ratio);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Pontuação ${score} de ${max}`}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="15"
        />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="15"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 14px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-5xl font-bold tabular-nums tracking-tight"
          style={{ color }}
        >
          {Math.round(display)}
        </span>
        <span className="mt-1 text-sm text-mist-400">de {max} pontos</span>
      </div>
    </div>
  );
}
