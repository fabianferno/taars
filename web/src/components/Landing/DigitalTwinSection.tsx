"use client";

import { motion, useInView } from "framer-motion";
import { Mic, Cpu, Globe, Zap, Shield, Network } from "lucide-react";
import { useRef, useEffect, useState } from "react";

const twinFeatures = [
  {
    icon: Mic,
    title: "Voice Identity",
    description:
      "60-second enrollment creates your sonic fingerprint, processed inside a TEE — never exposed.",
  },
  {
    icon: Cpu,
    title: "INFT Ownership",
    description:
      "Your twin is minted as ERC-7857 — an intelligent NFT carrying its own inference logic on 0G Chain.",
  },
  {
    icon: Globe,
    title: "ENS Subname",
    description:
      "Resolve as you.taars.eth across every dApp, wallet, and protocol in the decentralized web.",
  },
  {
    icon: Zap,
    title: "x402 Billing",
    description:
      "Micropayments per minute let anyone talk to your twin at rates you set. 90% flows to you.",
  },
  {
    icon: Shield,
    title: "TEE Privacy",
    description:
      "Original data is cryptographically destroyed after training. Zero-knowledge proof of deletion.",
  },
  {
    icon: Network,
    title: "Multi-Platform",
    description:
      "Deploy to Discord VCs, web chat, or any interface via the taars SDK — one twin, everywhere.",
  },
];

/* ── Animated digital-twin SVG ──────────────────────────────────────── */

function TwinVisualization() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(id);
  }, []);

  const nodes = [
    { cx: 220, cy: 160, r: 4 },
    { cx: 240, cy: 220, r: 3 },
    { cx: 200, cy: 270, r: 5 },
    { cx: 260, cy: 300, r: 3 },
    { cx: 230, cy: 350, r: 4 },
  ];

  const digitalNodes = nodes.map((n) => ({ ...n, cx: 580 - (n.cx - 400) }));

  return (
    <svg
      viewBox="0 0 800 520"
      className="w-full max-w-3xl mx-auto"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="humanGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ea580c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="digitalGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ea580c" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="digitalFilter">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="streamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" stopOpacity="0" />
          <stop offset="50%" stopColor="#ea580c" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </linearGradient>
        <clipPath id="leftHalf">
          <rect x="0" y="0" width="395" height="520" />
        </clipPath>
        <clipPath id="rightHalf">
          <rect x="405" y="0" width="395" height="520" />
        </clipPath>
      </defs>

      {/* ── background grid ── */}
      <g opacity="0.06">
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 53.3}
            y1="0"
            x2={i * 53.3}
            y2="520"
            stroke="#ea580c"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={i * 52}
            x2="800"
            y2={i * 52}
            stroke="#ea580c"
            strokeWidth="0.5"
          />
        ))}
      </g>

      {/* ── glow pools ── */}
      <ellipse cx="210" cy="280" rx="120" ry="140" fill="url(#humanGlow)" />
      <ellipse cx="590" cy="280" rx="120" ry="140" fill="url(#digitalGlow)" />

      {/* ── organic brain (left) ── */}
      <g clipPath="url(#leftHalf)" opacity="0.95">
        {/* outer brain silhouette */}
        <motion.path
          d="M130,260
             C130,200 160,160 210,160
             C260,160 290,200 290,260
             C290,310 270,360 240,380
             C220,395 200,395 180,380
             C150,360 130,310 130,260 Z"
          fill="none"
          stroke="#ea580c"
          strokeWidth="2"
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        {/* central fissure */}
        <motion.path
          d="M210,160 C208,200 212,260 210,330 C209,360 211,375 210,385"
          stroke="#ea580c"
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
        />
        {/* gyri / sulci - left hemisphere */}
        <path
          d="M150,210 C165,205 175,220 168,235 C175,245 165,260 175,270 C165,285 180,300 170,315 C180,330 165,345 175,360"
          stroke="#ea580c"
          strokeWidth="1.2"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M170,195 C185,200 190,215 180,225"
          stroke="#ea580c"
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M150,290 C165,285 178,295 172,310"
          stroke="#ea580c"
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        {/* gyri / sulci - right hemisphere */}
        <path
          d="M270,210 C255,205 245,220 252,235 C245,245 255,260 245,270 C255,285 240,300 250,315 C240,330 255,345 245,360"
          stroke="#ea580c"
          strokeWidth="1.2"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M250,195 C235,200 230,215 240,225"
          stroke="#ea580c"
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M270,290 C255,285 242,295 248,310"
          stroke="#ea580c"
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        {/* brainstem hint */}
        <path
          d="M200,385 C200,400 200,410 200,420 M220,385 C220,400 220,410 220,420"
          stroke="#ea580c"
          strokeWidth="1.2"
          fill="none"
          opacity="0.4"
        />
        {/* subtle pulsing thought dots */}
        {[
          [180, 220],
          [240, 230],
          [200, 280],
          [170, 330],
          [250, 350],
        ].map(([cx, cy], i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r="2"
            fill="#ea580c"
            animate={{ opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </g>

      {/* ORGANIC label */}
      <text
        x="210"
        y="465"
        textAnchor="middle"
        fill="#ea580c"
        fontSize="11"
        fontFamily="monospace"
        opacity="0.5"
        letterSpacing="4"
      >
        ORGANIC
      </text>

      {/* ── data stream (center) ── */}
      <g>
        {/* static track */}
        <line
          x1="340"
          y1="260"
          x2="460"
          y2="260"
          stroke="#ea580c"
          strokeWidth="0.5"
          opacity="0.2"
        />

        {/* animated data particles */}
        {[0, 0.33, 0.66].map((offset, i) => {
          const progress = ((tick / 80 + offset) % 1);
          const x = 340 + progress * 120;
          return (
            <circle
              key={i}
              cx={x}
              cy="260"
              r="3"
              fill="#ea580c"
              opacity={0.9 - Math.abs(progress - 0.5) * 1.2}
              filter="url(#glow)"
            />
          );
        })}

        {/* stream glow bar */}
        <motion.rect
          x="335"
          y="255"
          width="130"
          height="10"
          rx="5"
          fill="url(#streamGrad)"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />

        {/* zig-zag signal lines */}
        <motion.path
          d="M340,240 L360,252 L380,240 L400,252 L420,240 L440,252 L460,240"
          stroke="#ea580c"
          strokeWidth="1"
          fill="none"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />

        {/* center icon ring */}
        <motion.circle
          cx="400"
          cy="260"
          r="22"
          fill="none"
          stroke="#ea580c"
          strokeWidth="1"
          strokeDasharray="4 4"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "400px 260px" }}
        />
        <text
          x="400"
          y="265"
          textAnchor="middle"
          fill="#ea580c"
          fontSize="12"
          fontFamily="monospace"
        >
          AI
        </text>
      </g>

      {/* ── digital circuit brain (right) ── */}
      <g clipPath="url(#rightHalf)" filter="url(#digitalFilter)">
        {/* outer brain silhouette — dashed/glitch */}
        <motion.path
          d="M510,260
             C510,200 540,160 590,160
             C640,160 670,200 670,260
             C670,310 650,360 620,380
             C600,395 580,395 560,380
             C530,360 510,310 510,260 Z"
          fill="none"
          stroke="#ea580c"
          strokeWidth="2"
          strokeDasharray="8 4"
          animate={{ opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />
        {/* second outline — slightly offset, rotating glitch */}
        <motion.path
          d="M510,260
             C510,200 540,160 590,160
             C640,160 670,200 670,260
             C670,310 650,360 620,380
             C600,395 580,395 560,380
             C530,360 510,310 510,260 Z"
          fill="none"
          stroke="#ea580c"
          strokeWidth="0.8"
          strokeDasharray="3 6"
          opacity="0.4"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 0.4 }}
        />
        {/* central fissure */}
        <motion.path
          d="M590,160 L590,395"
          stroke="#ea580c"
          strokeWidth="1.5"
          strokeDasharray="5 3"
          fill="none"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* circuit traces — left hemisphere */}
        <path
          d="M535,210 L555,210 L555,235 L575,235 L575,260"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M530,290 L550,290 L550,315 L575,315"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M540,350 L560,350 L560,330 L580,330"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.7"
        />
        {/* circuit traces — right hemisphere */}
        <path
          d="M645,210 L625,210 L625,235 L605,235 L605,260"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M650,290 L630,290 L630,315 L605,315"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M640,350 L620,350 L620,330 L600,330"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.7"
        />
        {/* brainstem — circuit pins */}
        <path
          d="M580,385 L580,420 M600,385 L600,420 M590,395 L590,420"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeDasharray="3 2"
          fill="none"
          opacity="0.6"
        />

        {/* glowing circuit nodes */}
        {[
          [555, 210],
          [575, 260],
          [550, 290],
          [560, 350],
          [625, 210],
          [605, 260],
          [630, 290],
          [620, 350],
        ].map(([cx, cy], i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r="3.5"
            fill="#ea580c"
            animate={{ opacity: [0.4, 1, 0.4], r: [3, 4.5, 3] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}

        {/* binary/data flicker bits */}
        {[
          { x: 540, y: 245, t: "01" },
          { x: 640, y: 270, t: "10" },
          { x: 555, y: 335, t: "11" },
          { x: 625, y: 360, t: "00" },
        ].map((b, i) => (
          <motion.text
            key={i}
            x={b.x}
            y={b.y}
            fill="#ea580c"
            fontSize="7"
            fontFamily="monospace"
            opacity="0.5"
            animate={{ opacity: [0.1, 0.7, 0.1] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5 }}
          >
            {b.t}
          </motion.text>
        ))}

        {/* floating satellite nodes with link lines */}
        {[
          [510, 200],
          [670, 240],
          [495, 320],
          [685, 360],
        ].map(([cx, cy], i) => (
          <motion.g key={i}>
            <motion.circle
              cx={cx}
              cy={cy}
              r="3"
              fill="none"
              stroke="#ea580c"
              strokeWidth="1"
              animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.4, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            <motion.line
              x1={cx}
              y1={cy}
              x2="590"
              y2="270"
              stroke="#ea580c"
              strokeWidth="0.5"
              animate={{ opacity: [0, 0.35, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
            />
          </motion.g>
        ))}
      </g>

      {/* DIGITAL label */}
      <text
        x="590"
        y="465"
        textAnchor="middle"
        fill="#ea580c"
        fontSize="11"
        fontFamily="monospace"
        opacity="0.5"
        letterSpacing="4"
      >
        DIGITAL
      </text>

      {/* ── floating bits top ── */}
      {[
        [100, 60],
        [320, 40],
        [480, 30],
        [680, 55],
        [740, 90],
      ].map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="2"
          fill="#ea580c"
          animate={{ opacity: [0, 0.6, 0], y: [0, -12, 0] }}
          transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.7 }}
        />
      ))}
    </svg>
  );
}

/* ── Main section ────────────────────────────────────────────────────── */

export default function DigitalTwinSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 sm:py-32 overflow-hidden" ref={ref}>
      <div className="max-w-7xl mx-auto px-6">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-0"
        >
          <span className="inline-block text-xs font-mono tracking-widest uppercase text-accent mb-4">
            01 — Digital Twin
          </span>
          <h2 className="font-coolvetica text-4xl sm:text-5xl text-foreground">
            You, but always on.
          </h2>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
            taars forges a verifiable, blockchain-anchored replica of you —
            indistinguishable in voice and personality, yet fully sovereign.
          </p>
        </motion.div>

        {/* SVG visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-12 sm:mb-14"
        >
          <TwinVisualization />
        </motion.div>

        {/* feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {twinFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              className="group flex gap-4 rounded-2xl border border-accent/10 hover:border-accent/30 bg-background p-6 transition-colors"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl bg-accent/10 group-hover:bg-accent/20 flex items-center justify-center transition-colors">
                <f.icon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm mb-1">
                  {f.title}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {f.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
