"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Mic,
  Shield,
  Globe,
  Zap,
  Cpu,
  Network,
  Users,
  DollarSign,
  Lock,
  ExternalLink,
  Radio,
  Layers,
  MessageCircle,
  Briefcase,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const ACCENT = "#ea580c";

/* ─── shared atoms ──────────────────────────────────────── */

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <p className="text-xs font-mono tracking-widest uppercase mb-6 opacity-70">
      <span style={{ color: ACCENT }}>{n}</span>
      <span className="text-white/40"> — {label}</span>
    </p>
  );
}

/* ─── animated SVG visuals ──────────────────────────────── */

function OrbitVisual() {
  return (
    <svg viewBox="0 0 400 400" className="w-72 h-72 md:w-96 md:h-96">
      <defs>
        <radialGradient id="orbCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.6" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="80" fill="url(#orbCore)" />
      {[80, 120, 160].map((r, i) => (
        <motion.circle
          key={r}
          cx="200"
          cy="200"
          r={r}
          fill="none"
          stroke={ACCENT}
          strokeWidth="0.6"
          strokeDasharray="3 6"
          opacity={0.4 - i * 0.1}
          animate={{ rotate: i % 2 ? 360 : -360 }}
          transition={{ duration: 20 + i * 10, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "200px 200px" }}
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * 60 * Math.PI) / 180;
        return (
          <motion.g key={i} animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "200px 200px" }}>
            <motion.circle
              cx={200 + Math.cos(angle) * 120}
              cy={200 + Math.sin(angle) * 120}
              r="6"
              fill={ACCENT}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
          </motion.g>
        );
      })}
      <motion.circle
        cx="200"
        cy="200"
        r="32"
        fill="#0a0a0a"
        stroke={ACCENT}
        strokeWidth="1.5"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ transformOrigin: "200px 200px" }}
      />
      <text
        x="200"
        y="206"
        textAnchor="middle"
        fill={ACCENT}
        fontSize="18"
        fontFamily="var(--font-coolvetica)"
      >
        AI
      </text>
    </svg>
  );
}

function ProblemVisual() {
  return (
    <svg viewBox="0 0 480 320" className="w-full max-w-md">
      {/* one human */}
      <g>
        <circle cx="80" cy="120" r="22" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" />
        <path d="M80,142 L80,210 M80,160 L55,195 M80,160 L105,195 M80,210 L65,260 M80,210 L95,260" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" fill="none" />
      </g>
      {/* many requests */}
      {[
        { x: 280, y: 50, delay: 0 },
        { x: 360, y: 100, delay: 0.4 },
        { x: 380, y: 180, delay: 0.8 },
        { x: 320, y: 250, delay: 1.2 },
        { x: 230, y: 270, delay: 1.6 },
      ].map((req, i) => (
        <motion.g
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: req.delay }}
        >
          <circle cx={req.x} cy={req.y} r="14" fill="none" stroke="#ef4444" strokeWidth="1.5" />
          <line x1={req.x - 5} y1={req.y - 5} x2={req.x + 5} y2={req.y + 5} stroke="#ef4444" strokeWidth="2" />
          <line x1={req.x + 5} y1={req.y - 5} x2={req.x - 5} y2={req.y + 5} stroke="#ef4444" strokeWidth="2" />
          <line x1="115" y1="170" x2={req.x - 14} y2={req.y} stroke="#ef4444" strokeOpacity="0.2" strokeWidth="0.6" strokeDasharray="3 3" />
        </motion.g>
      ))}
      <text x="80" y="295" textAnchor="middle" fill="#fff" fillOpacity="0.4" fontSize="10" fontFamily="monospace">
        YOU
      </text>
      <text x="320" y="20" textAnchor="middle" fill="#ef4444" fontSize="10" fontFamily="monospace">
        MISSED OPPORTUNITIES
      </text>
    </svg>
  );
}

function ConvergenceVisual() {
  const items = [
    { x: 140, y: 110, label: "VOICE AI", color: ACCENT },
    { x: 340, y: 110, label: "TEE", color: ACCENT },
    { x: 140, y: 270, label: "x402", color: ACCENT },
    { x: 340, y: 270, label: "ENS / INFT", color: ACCENT },
  ];
  return (
    <svg viewBox="0 0 480 380" className="w-full max-w-lg">
      <defs>
        <radialGradient id="convergeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="190" r="100" fill="url(#convergeGlow)" />
      {items.map((it, i) => (
        <g key={it.label}>
          <motion.line
            x1={it.x}
            y1={it.y}
            x2="240"
            y2="190"
            stroke={ACCENT}
            strokeWidth="1"
            strokeDasharray="4 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 1, delay: i * 0.2 }}
          />
          <motion.circle
            cx={it.x}
            cy={it.y}
            r="34"
            fill="#0a0a0a"
            stroke={ACCENT}
            strokeWidth="1"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4 }}
          />
          <text x={it.x} y={it.y + 4} textAnchor="middle" fill={ACCENT} fontSize="10" fontFamily="monospace">
            {it.label}
          </text>
          {/* moving particle */}
          <motion.circle
            cx={it.x}
            cy={it.y}
            r="3"
            fill={ACCENT}
            animate={{
              cx: [it.x, 240],
              cy: [it.y, 190],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
          />
        </g>
      ))}
      <motion.circle
        cx="240"
        cy="190"
        r="42"
        fill="#0a0a0a"
        stroke={ACCENT}
        strokeWidth="2"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ transformOrigin: "240px 190px" }}
      />
      <text x="240" y="186" textAnchor="middle" fill="#fff" fontSize="14" fontFamily="var(--font-coolvetica)">
        taars
      </text>
      <text x="240" y="202" textAnchor="middle" fill="#fff" fillOpacity="0.4" fontSize="8" fontFamily="monospace">
        NOW POSSIBLE
      </text>
    </svg>
  );
}

function TwinFlowVisual() {
  return (
    <svg viewBox="0 0 600 280" className="w-full max-w-2xl">
      <defs>
        <linearGradient id="flowGrad" x1="0%" x2="100%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0" />
          <stop offset="50%" stopColor={ACCENT} stopOpacity="1" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* human */}
      <g>
        <circle cx="80" cy="100" r="26" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
        <path d="M80,126 L80,200 M80,148 L48,180 M80,148 L112,180 M80,200 L62,250 M80,200 L98,250" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" fill="none" />
        <text x="80" y="278" textAnchor="middle" fill="#fff" fillOpacity="0.5" fontSize="10" fontFamily="monospace">YOU</text>
      </g>

      {/* arrow flow */}
      <motion.line
        x1="125"
        y1="150"
        x2="475"
        y2="150"
        stroke="url(#flowGrad)"
        strokeWidth="3"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {[0, 0.33, 0.66].map((o, i) => (
        <motion.circle
          key={i}
          cy="150"
          r="4"
          fill={ACCENT}
          animate={{ cx: [125, 475], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: o * 2.4 }}
        />
      ))}

      {/* labels along flow */}
      {[
        { x: 200, label: "VOICE" },
        { x: 300, label: "TEE" },
        { x: 400, label: "INFT" },
      ].map((s) => (
        <g key={s.label}>
          <circle cx={s.x} cy="150" r="14" fill="#0a0a0a" stroke={ACCENT} strokeOpacity="0.5" />
          <text x={s.x} y="125" textAnchor="middle" fill={ACCENT} fontSize="9" fontFamily="monospace">{s.label}</text>
        </g>
      ))}

      {/* digital twin */}
      <g>
        <motion.circle cx="520" cy="100" r="26" fill="none" stroke={ACCENT} strokeWidth="2" strokeDasharray="5 3" animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "520px 100px" }} />
        <path d="M520,126 L520,200 M520,148 L488,180 M520,148 L552,180 M520,200 L502,250 M520,200 L538,250" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 2" fill="none" />
        {[[488, 180], [552, 180], [502, 250], [538, 250]].map(([cx, cy], i) => (
          <motion.circle key={i} cx={cx} cy={cy} r="4" fill={ACCENT} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
        ))}
        <text x="520" y="278" textAnchor="middle" fill={ACCENT} fontSize="10" fontFamily="monospace">YOUR TWIN</text>
      </g>
    </svg>
  );
}

function PipelineVisual() {
  const stages = [
    { x: 60, label: "RECORD", icon: "🎙" },
    { x: 200, label: "DEFINE" },
    { x: 340, label: "MINT" },
    { x: 480, label: "DEPLOY" },
  ];
  return (
    <svg viewBox="0 0 540 200" className="w-full max-w-2xl">
      {stages.map((s, i) => (
        <g key={s.label}>
          {/* connector */}
          {i < stages.length - 1 && (
            <>
              <line x1={s.x + 30} y1="100" x2={stages[i + 1].x - 30} y2="100" stroke={ACCENT} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />
              <motion.circle cy="100" r="3" fill={ACCENT} animate={{ cx: [s.x + 30, stages[i + 1].x - 30], opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }} />
            </>
          )}
          {/* node */}
          <motion.circle cx={s.x} cy="100" r="28" fill="#0a0a0a" stroke={ACCENT} strokeWidth="1.5" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} style={{ transformOrigin: `${s.x}px 100px` }} />
          <text x={s.x} y="105" textAnchor="middle" fill="#fff" fontSize="14" fontFamily="var(--font-coolvetica)">{`0${i + 1}`}</text>
          <text x={s.x} y="150" textAnchor="middle" fill={ACCENT} fontSize="9" fontFamily="monospace" letterSpacing="2">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

function StackVisual() {
  const layers = [
    { y: 40, label: "DEPLOY", sub: "Discord · Web · SDK", color: "#fff" },
    { y: 90, label: "BILLING", sub: "x402 · USDC", color: ACCENT },
    { y: 140, label: "IDENTITY", sub: "ENS Subname", color: "#fff" },
    { y: 190, label: "OWNERSHIP", sub: "ERC-7857 · 0G Chain", color: ACCENT },
    { y: 240, label: "PRIVACY", sub: "TEE · 0G Compute", color: "#fff" },
  ];
  return (
    <svg viewBox="0 0 320 290" className="w-full max-w-md">
      {layers.map((l, i) => (
        <motion.g
          key={l.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
        >
          <rect
            x="20"
            y={l.y}
            width="280"
            height="38"
            rx="6"
            fill={l.color === ACCENT ? `${ACCENT}15` : "rgba(255,255,255,0.04)"}
            stroke={l.color === ACCENT ? `${ACCENT}50` : "rgba(255,255,255,0.1)"}
          />
          <text x="36" y={l.y + 17} fill={l.color} fontSize="11" fontFamily="monospace" fontWeight="bold" letterSpacing="2">
            {l.label}
          </text>
          <text x="36" y={l.y + 30} fill="#fff" fillOpacity="0.4" fontSize="9" fontFamily="monospace">
            {l.sub}
          </text>
          <motion.circle
            cx="284"
            cy={l.y + 19}
            r="4"
            fill={ACCENT}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
          />
        </motion.g>
      ))}
    </svg>
  );
}

function RevenuePieVisual() {
  const total = 100;
  const slices = [
    { value: 90, color: ACCENT, label: "Creator" },
    { value: 7, color: "#fbbf24", label: "Platform" },
    { value: 3, color: "#a3a3a3", label: "Royalty" },
  ];
  let cumulative = 0;
  const radius = 90;
  const cx = 130;
  const cy = 130;

  const arcs = slices.map((s) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += s.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const large = s.value > 50 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...s, path };
  });

  return (
    <svg viewBox="0 0 260 260" className="w-64 h-64">
      {arcs.map((a, i) => (
        <motion.path
          key={a.label}
          d={a.path}
          fill={a.color}
          fillOpacity={0.85}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: i * 0.15 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
      <circle cx={cx} cy={cy} r="50" fill="#0a0a0a" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#fff" fontSize="22" fontFamily="var(--font-coolvetica)">
        90%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#fff" fillOpacity="0.4" fontSize="9" fontFamily="monospace">
        TO YOU
      </text>
    </svg>
  );
}

function NetworkVisual() {
  const nodes = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * 2 * Math.PI;
    const ring = i < 7 ? 80 : 140;
    return {
      x: 200 + Math.cos(angle + (i < 7 ? 0 : 0.2)) * ring,
      y: 200 + Math.sin(angle + (i < 7 ? 0 : 0.2)) * ring,
      ring,
    };
  });
  return (
    <svg viewBox="0 0 400 400" className="w-80 h-80 md:w-96 md:h-96">
      <defs>
        <radialGradient id="netGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="80" fill="url(#netGlow)" />

      {nodes.map((n, i) => (
        <motion.line
          key={`line-${i}`}
          x1="200"
          y1="200"
          x2={n.x}
          y2={n.y}
          stroke={ACCENT}
          strokeWidth="0.4"
          strokeOpacity="0.3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: i * 0.05 }}
        />
      ))}

      {nodes.map((n, i) => (
        <motion.g key={`node-${i}`}>
          <motion.circle
            cx={n.x}
            cy={n.y}
            r="6"
            fill={ACCENT}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.15 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
          <motion.circle
            cx={n.x}
            cy={n.y}
            r="3"
            fill="#0a0a0a"
          />
        </motion.g>
      ))}

      {/* center hub */}
      <motion.circle
        cx="200"
        cy="200"
        r="32"
        fill="#0a0a0a"
        stroke={ACCENT}
        strokeWidth="2"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ transformOrigin: "200px 200px" }}
      />
      <text x="200" y="207" textAnchor="middle" fill="#fff" fontSize="16" fontFamily="var(--font-coolvetica)">
        taars
      </text>
    </svg>
  );
}

/* ─── slides ───────────────────────────────────────────── */

function Slide01Title() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto px-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <OrbitVisual />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="font-coolvetica text-7xl md:text-8xl text-white -mt-10"
      >
        taars
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="text-xl md:text-2xl mt-3 font-mono"
        style={{ color: ACCENT }}
      >
        AI digital twins for humans
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.7 }}
        className="flex flex-wrap gap-2 mt-8 justify-center"
      >
        {["0G Chain", "ENS", "ERC-7857", "x402", "TEE"].map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full text-xs font-mono border"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {tag}
          </span>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="mt-12"
      >
        <ChevronDown className="w-5 h-5 text-white/30 animate-bounce mx-auto" />
      </motion.div>
    </div>
  );
}

function Slide02Problem() {
  return (
    <div className="max-w-6xl mx-auto px-8 md:px-20 w-full grid md:grid-cols-2 gap-12 items-center">
      <div>
        <SectionLabel n="01" label="Problem" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white mb-6 leading-tight">
          You can&apos;t<br />be everywhere.
        </h2>
        <div className="space-y-3 mt-8">
          {["Knowledge dies with presence", "No way to monetize attention", "AI clones lack accountability"].map((p) => (
            <div key={p} className="flex items-center gap-3">
              <div className="w-1 h-1 rounded-full bg-red-400" />
              <p className="text-white/60 text-base">{p}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center">
        <ProblemVisual />
      </div>
    </div>
  );
}

function Slide03WhyNow() {
  return (
    <div className="max-w-6xl mx-auto px-8 md:px-20 w-full grid md:grid-cols-2 gap-12 items-center">
      <div className="flex justify-center order-2 md:order-1">
        <ConvergenceVisual />
      </div>
      <div className="order-1 md:order-2">
        <SectionLabel n="02" label="Why Now" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white mb-6 leading-tight">
          The stack<br />just aligned.
        </h2>
        <div className="grid grid-cols-2 gap-3 mt-8">
          {[
            { tag: "Voice AI", note: "indistinguishable" },
            { tag: "TEE Compute", note: "verifiable privacy" },
            { tag: "x402", note: "micropayments" },
            { tag: "ENS + INFT", note: "on-chain identity" },
          ].map((s) => (
            <div
              key={s.tag}
              className="rounded-xl border p-3"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}
            >
              <p className="font-mono text-xs" style={{ color: ACCENT }}>{s.tag}</p>
              <p className="text-white/50 text-xs mt-1">{s.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide04Solution() {
  return (
    <div className="max-w-6xl mx-auto px-8 md:px-20 w-full">
      <div className="text-center mb-8">
        <SectionLabel n="03" label="Solution" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white leading-tight">
          Your <span style={{ color: ACCENT }}>digital twin</span>, owned on-chain.
        </h2>
      </div>

      <div className="flex justify-center my-10">
        <TwinFlowVisual />
      </div>

      <div className="grid grid-cols-3 gap-5 max-w-3xl mx-auto">
        {[
          { stat: "60s", label: "to clone you" },
          { stat: "0KB", label: "data retained" },
          { stat: "∞", label: "conversations" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border p-5 text-center"
            style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}06` }}
          >
            <p className="font-coolvetica text-5xl" style={{ color: ACCENT }}>{s.stat}</p>
            <p className="text-white/40 text-xs mt-1 font-mono uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide05HowItWorks() {
  return (
    <div className="max-w-6xl mx-auto px-8 md:px-20 w-full">
      <div className="text-center mb-12">
        <SectionLabel n="04" label="How It Works" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white leading-tight">
          Forge in <span style={{ color: ACCENT }}>four steps</span>.
        </h2>
      </div>

      <div className="flex justify-center mb-10">
        <PipelineVisual />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {[
          { icon: Mic, label: "Record voice" },
          { icon: Sparkles, label: "Define personality" },
          { icon: Cpu, label: "Mint INFT" },
          { icon: Network, label: "Deploy anywhere" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: ACCENT }} />
            <p className="text-white/60 text-xs font-mono uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide06Tech() {
  return (
    <div className="max-w-6xl mx-auto px-8 md:px-20 w-full grid md:grid-cols-2 gap-12 items-center">
      <div>
        <SectionLabel n="05" label="Architecture" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white mb-6 leading-tight">
          Verifiable<br />by design.
        </h2>
        <p className="text-white/40 text-sm max-w-sm mb-6">
          Every layer is cryptographically attested. No black boxes.
        </p>
        <div className="flex flex-wrap gap-2">
          {["OpenVoice", "0G Compute", "ERC-7857", "ENS", "x402"].map((t) => (
            <span
              key={t}
              className="px-2 py-1 rounded-full text-xs font-mono border"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-center">
        <StackVisual />
      </div>
    </div>
  );
}

function Slide07UseCases() {
  const cases = [
    { icon: Radio, label: "Discord VC" },
    { icon: MessageCircle, label: "Web Chat" },
    { icon: DollarSign, label: "Creator Sales" },
    { icon: Briefcase, label: "Enterprise" },
  ];
  return (
    <div className="max-w-5xl mx-auto px-8 md:px-20 w-full">
      <div className="text-center mb-14">
        <SectionLabel n="06" label="Use Cases" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white leading-tight">
          One twin. <span style={{ color: ACCENT }}>Every context.</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {cases.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="rounded-2xl border p-8 flex flex-col items-center text-center hover:border-orange-500/40 transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}
            >
              <c.icon className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <p className="text-white font-semibold text-sm">{c.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ACCENT }} />
        <p className="text-white/40 text-xs font-mono">LIVE ON SEPOLIA</p>
      </div>
    </div>
  );
}

function Slide08Business() {
  return (
    <div className="max-w-6xl mx-auto px-8 md:px-20 w-full grid md:grid-cols-2 gap-12 items-center">
      <div>
        <SectionLabel n="07" label="Business Model" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white mb-6 leading-tight">
          Every minute<br />pays out.
        </h2>
        <div className="space-y-3 mt-8">
          {[
            { pct: "90%", label: "Creator", color: ACCENT },
            { pct: "7%", label: "Platform", color: "#fbbf24" },
            { pct: "3%", label: "Royalty pool", color: "#a3a3a3" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-coolvetica text-lg"
                style={{ background: `${r.color}15`, color: r.color }}
              >
                {r.pct}
              </div>
              <p className="text-white/70 text-sm">{r.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center">
        <RevenuePieVisual />
      </div>
    </div>
  );
}

function Slide09Traction() {
  const items = [
    { label: "INFT mint flow", done: true },
    { label: "TEE voice pipeline", done: true },
    { label: "ENS subname resolver", done: true },
    { label: "x402 billing live", done: true },
    { label: "Discord VC bot", done: true },
    { label: "SDK public release", done: false },
    { label: "Mobile app", done: false },
    { label: "Enterprise tier", done: false },
  ];
  return (
    <div className="max-w-5xl mx-auto px-8 md:px-20 w-full">
      <div className="text-center mb-14">
        <SectionLabel n="08" label="Traction" />
        <h2 className="font-coolvetica text-5xl md:text-6xl text-white leading-tight">
          Shipped <span style={{ color: ACCENT }}>at hackathon</span>.
        </h2>
      </div>

      <div className="relative max-w-2xl mx-auto">
        {/* timeline line */}
        <div
          className="absolute left-4 top-2 bottom-2 w-px"
          style={{ background: `linear-gradient(to bottom, ${ACCENT} 60%, rgba(255,255,255,0.15) 60%)` }}
        />
        <div className="space-y-3">
          {items.map((it, i) => (
            <motion.div
              key={it.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="flex items-center gap-5 pl-1"
            >
              <div
                className="w-3 h-3 rounded-full border-2 z-10"
                style={{
                  background: it.done ? ACCENT : "#0a0a0a",
                  borderColor: it.done ? ACCENT : "rgba(255,255,255,0.2)",
                }}
              />
              <p
                className={`text-sm ${it.done ? "text-white" : "text-white/40"}`}
              >
                {it.label}
              </p>
              {it.done && (
                <span className="text-xs font-mono" style={{ color: ACCENT }}>✓</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide10Closing() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-4xl mx-auto px-8">
      <NetworkVisual />

      <h2 className="font-coolvetica text-5xl md:text-6xl text-white leading-tight mt-2">
        A twin for every <span style={{ color: ACCENT }}>human</span>.
      </h2>

      <div className="flex flex-col sm:flex-row gap-3 mt-10">
        <Link
          href="/create"
          className="group inline-flex items-center gap-2 font-medium px-7 py-3.5 rounded-full transition-all text-white"
          style={{ background: ACCENT }}
        >
          Create your taar
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 border font-medium px-7 py-3.5 rounded-full transition-all text-white/70 hover:text-white border-white/20 hover:border-white/40"
        >
          Explore taars
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      <p className="text-white/20 text-xs font-mono mt-12">
        taars.eth · 0G · TEE · sovereign
      </p>
    </div>
  );
}

/* ─── slide registry + shell ───────────────────────────── */

const SLIDES = [
  { id: "title", component: Slide01Title },
  { id: "problem", component: Slide02Problem },
  { id: "why-now", component: Slide03WhyNow },
  { id: "solution", component: Slide04Solution },
  { id: "how", component: Slide05HowItWorks },
  { id: "architecture", component: Slide06Tech },
  { id: "use-cases", component: Slide07UseCases },
  { id: "business", component: Slide08Business },
  { id: "traction", component: Slide09Traction },
  { id: "vision", component: Slide10Closing },
];

export default function PitchPage() {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= SLIDES.length) return;
    isScrolling.current = true;
    setCurrent(idx);
    const el = containerRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => { isScrolling.current = false; }, 800);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (["ArrowUp", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, goTo]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Array.from(container.children).indexOf(entry.target);
            if (idx !== -1) setCurrent(idx);
          }
        }
      },
      { threshold: 0.6 }
    );
    Array.from(container.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative bg-[#0a0a0a] h-screen overflow-hidden" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
      {/* slide counter */}
      <div className="fixed bottom-8 right-8 z-50 text-white/30 text-xs font-mono">
        {String(current + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
      </div>

      {/* dot indicators */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="rounded-full transition-all duration-300 focus:outline-none"
            style={{
              width: i === current ? 6 : 4,
              height: i === current ? 20 : 4,
              background: i === current ? ACCENT : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      {/* nav arrows */}
      <AnimatePresence>
        {current > 0 && (
          <motion.button
            key="up"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goTo(current - 1)}
            className="fixed left-1/2 -translate-x-1/2 top-6 z-50 text-white/30 hover:text-white/70 transition-colors"
          >
            <ChevronUp className="w-6 h-6" />
          </motion.button>
        )}
        {current < SLIDES.length - 1 && (
          <motion.button
            key="down"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => goTo(current + 1)}
            className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 text-white/30 hover:text-white/70 transition-colors"
          >
            <ChevronDown className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* back to home */}
      <Link
        href="/"
        className="fixed top-6 left-8 z-50 flex items-center gap-2 text-white/30 hover:text-white/70 transition-colors text-sm font-mono"
      >
        ← taars
      </Link>

      {/* keyboard hint */}
      <p className="fixed bottom-8 left-8 z-50 text-white/15 text-xs font-mono hidden md:block">
        ↑ ↓ to navigate
      </p>

      {/* scroll container */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-auto snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {SLIDES.map(({ id, component: SlideComponent }) => (
          <div
            key={id}
            className="snap-start h-screen flex items-center overflow-hidden"
          >
            <SlideComponent />
          </div>
        ))}
      </div>
    </div>
  );
}
