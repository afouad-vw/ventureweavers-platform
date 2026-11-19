"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Illustrative stories and questions from the room, and topics it suggests for next time.
const QUESTIONS = [
  "How do we get a new idea funded inside a big company?",
  "Our story: we pivoted three months before the cash ran out",
  "Should I quit my job to build?",
  "My first angel cheque taught me this",
  "How small can a pilot be and still count?",
  "We lost our biggest client in month two. Here's what we did",
];
const TOPICS = ["Selling ideas to leadership", "Building a venture team", "Partnering with startups", "Raising your first round", "Angel investing 101", "AI in your venture"];

/**
 * Open Floor, animated: the 3D stage with sweeping spotlights, audience questions that rise from the room
 * and a live vote that picks one. Runs only while on screen; still frame for reduced motion.
 */
export function OpenFloorStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [tick, setTick] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!on || still) return;
    const t = setInterval(() => setTick((n) => n + 1), 2600);
    return () => clearInterval(t);
  }, [on, still]);

  // Three questions float up at a time; the vote counts towards the newest one.
  const visible = [0, 1, 2].map((k) => ({ q: QUESTIONS[(tick + k) % QUESTIONS.length], k }));
  const votes = [38 + ((tick * 7) % 19), 22 + ((tick * 5) % 13), 14 + ((tick * 3) % 9)];
  const total = votes.reduce((a, b) => a + b, 0);

  return (
    <div ref={ref} className={`lp-of relative ${on && !still ? "lp-of-on" : ""}`}>
      <div className="pointer-events-none absolute inset-x-[10%] bottom-[8%] h-[40%] rounded-full bg-[#E39B2D] opacity-25 blur-[90px]" />
      <div className="lp-of-beams pointer-events-none absolute inset-0" aria-hidden="true">
        <span style={{ left: "33.3%" }} />
        <span style={{ left: "50.0%" }} />
        <span style={{ left: "66.7%" }} />
      </div>
      <Image
        src="/landing/openfloor.webp"
        alt="Open Floor: hosts and a founder on a round stage under amber spotlights, the audience raising their hands"
        width={1800}
        height={1476}
        quality={90}
        sizes="(min-width: 900px) 760px, 100vw"
        className="relative h-auto w-full select-none"
        draggable={false}
      />
      {/* Questions rise from the audience. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {visible.map(({ q, k }) => (
          <span key={`${tick}-${k}`} className="lp-q" style={{ left: `${[58, 76, 67][k]}%`, "--k": k } as React.CSSProperties}>
            <span className="lp-q-hand">💬</span> {q}
          </span>
        ))}
      </div>
      {/* The room votes. */}
      <div className="lp-vote lp-glass absolute top-[2%] left-0 w-[min(250px,46%)] rounded-2xl p-3" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] font-bold tracking-[.12em] text-[#F2B65A] uppercase">Next topic?</span>
          <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-white/70"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E39B2D]" />Live</span>
        </div>
        {votes.map((v, i) => (
          <div key={i} className="mt-2">
            <div className="flex justify-between text-[11px] text-white/75"><span className="max-w-[80%] truncate">{TOPICS[(Math.floor(tick / 4) * 3 + i) % TOPICS.length]}</span><b>{Math.round((v / total) * 100)}%</b></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${(v / total) * 100}%`, background: i === 0 ? "#E39B2D" : "rgb(227 155 45 / 0.45)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The VentureWeavers mark as three threads that weave themselves in, then the wordmark. */
export function LogoWeave() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.setAttribute("data-in", ""); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.setAttribute("data-in", ""); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="lp-logo relative mx-auto w-full max-w-[560px]">
      <div className="pointer-events-none absolute inset-[-20%] rounded-full bg-[radial-gradient(circle,rgb(41_190_156/0.35),transparent_65%)] blur-2xl" />
      <svg viewBox="-2 -2 66 25" className="relative w-full overflow-visible" role="img" aria-label="VentureWeavers">
        <defs>
          <linearGradient id="lpw-a" x1="0" x2="1"><stop offset="0" stopColor="#29BE9C" /><stop offset="1" stopColor="#DCF1DD" /></linearGradient>
          <filter id="lpw-glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="0.9" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g filter="url(#lpw-glow)">
          <path className="lp-logo-p" style={{ "--d": "0s" } as React.CSSProperties} fill="#02686F" d="M36.65,20.95c-.14,0-.28,0-.43-.01-.12,0-.25-.02-.37-.03-2.22-.27-4.09-1.81-4.94-3.88l-4.71-11.41c-.42-1.02-1.34-1.79-2.43-1.91-.1-.01-.19-.02-.29-.02,0,0-.02,0-.03,0-1.01,0-1.96.47-2.55,1.28l-1.79,2.45c-.5.68-1.44.93-2.16.5-.83-.49-1.04-1.58-.49-2.34l1.83-2.5c1.22-1.67,3.19-2.64,5.24-2.61.13,0,.26,0,.39.02,2.34.18,4.35,1.76,5.24,3.94l4.7,11.38c.42,1.03,1.36,1.81,2.47,1.92.09,0,.19.01.28.02.93,0,1.81-.43,2.43-1.13l2.46-2.76c.56-.63,1.52-.78,2.2-.29.78.57.88,1.67.26,2.38l-2.58,2.9c-1.22,1.37-2.92,2.13-4.74,2.13Z" />
          <path className="lp-logo-p" style={{ "--d": ".25s" } as React.CSSProperties} fill="url(#lpw-a)" d="M20.49,20.95c-.14,0-.28,0-.43-.01-.12,0-.25-.02-.37-.03-2.22-.27-4.09-1.81-4.94-3.88l-4.71-11.41c-.42-1.02-1.34-1.79-2.43-1.91-.1-.01-.19-.02-.29-.02,0,0-.02,0-.03,0-1.01,0-1.96.47-2.55,1.28l-1.79,2.45c-.5.68-1.44.93-2.16.5-.83-.49-1.04-1.58-.49-2.34l1.83-2.5C3.35,1.4,5.33.43,7.38.46c.13,0,.26,0,.39.02,2.34.18,4.35,1.76,5.24,3.94l4.7,11.38c.42,1.03,1.36,1.81,2.47,1.92.09,0,.19.01.28.02.93,0,1.81-.43,2.43-1.13l2.46-2.76c.56-.63,1.52-.78,2.2-.29.78.57.88,1.67.26,2.38l-2.58,2.9c-1.22,1.37-2.92,2.13-4.74,2.13Z" />
          <path className="lp-logo-p" style={{ "--d": ".5s" } as React.CSSProperties} fill="#02686F" d="M50.16,15.81c.39.94,1.2,1.68,2.2,1.86.18.03.36.05.54.05.93,0,1.81-.43,2.43-1.13l2.47-2.78,1.42-1.79s.02-.03.04-.04c2.28-2.68,2.42-5.23.39-7.02-1.73-1.52-4.73-2.01-6.29-.29-.02.03-.04.06-.07.09l-1.8,2.47c-.5.68-1.44.93-2.16.5-.83-.49-1.04-1.58-.49-2.34l1.83-2.5c.08-.11.17-.24.3-.37,2.85-3.15,7.89-2.53,10.81.03,2.57,2.26,4.1,6.62-.04,11.51l-1.43,1.81-.06.07-2.58,2.9c-1.22,1.37-2.92,2.13-4.74,2.13-.14,0-.28,0-.43-.01-.12,0-.25-.02-.37-.03-2.22-.27-4.09-1.81-4.94-3.87-1.12-2.72-3.94-9.54-4.76-11.54-.26-.62-.7-1.16-1.3-1.47-.42-.21-.88-.33-1.37-.34-1.03-.03-1.97.45-2.58,1.28l-1.79,2.45c-.5.68-1.44.93-2.16.5-.83-.49-1.04-1.58-.49-2.34l1.74-2.39c.91-1.25,2.21-2.18,3.71-2.54.67-.16,1.34-.21,2-.16,2.34.18,4.35,1.76,5.25,3.94l4.71,11.4Z" />
        </g>
      </svg>
      <div className="lp-logo-word relative mt-6 flex justify-center">
        <Image src="/brand/logo-on-dark.svg" alt="" width={300} height={21} className="h-auto w-[min(300px,70%)]" />
      </div>
    </div>
  );
}

const SESSIONS = [
  { t: "The Leaders of Tomorrow", s: "Building the mindset", f: "Wellness & mindfulness" },
  { t: "The Investment Landscape", s: "Where capital comes from", f: "Role play" },
  { t: "VC: Misconception vs. Reality", s: "How it really works", f: "Guest speakers" },
  { t: "Multiple Dimensions of Success", s: "Beyond the returns", f: "Game / challenge" },
  { t: "The Healthy Ecosystem", s: "How the parts connect", f: "Panel discussion" },
  { t: "The Future of VC", s: "Your path forward", f: "Book club" },
];
const PATH_W = 600, PATH_H = 380, CYCLE = 9;
const NODES = SESSIONS.map((_, i) => ({ x: 50 + i * 100, y: i % 2 ? 250 : 130 }));

/**
 * TVAC's six sessions as one path: a light travels the curriculum at an even pace and each session lights up
 * as it passes. Runs only while on screen; still for reduced motion.
 */
export function TvacPath() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const d = NODES.map((n, i) => `${i ? "L" : "M"}${n.x} ${n.y}`).join(" ");
  return (
    <div ref={ref} className={`lp-tvac relative ${on ? "lp-tvac-on" : ""}`} style={{ "--cycle": `${CYCLE}s` } as React.CSSProperties}>
      <div className="pointer-events-none absolute inset-x-[8%] top-[20%] h-[60%] rounded-full bg-[#1F4FA3] opacity-30 blur-[90px]" />
      <div className="lp-glass relative rounded-[28px] p-4 desk:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] font-bold tracking-[.14em] text-[#8AAEF0] uppercase">The curriculum · 6 sessions</span>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/60"><GraduationCapIcon />TVAC</span>
        </div>
        <div className="relative mt-2 hidden sm:block" style={{ aspectRatio: `${PATH_W} / ${PATH_H}` }}>
          <svg viewBox={`0 0 ${PATH_W} ${PATH_H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <filter id="lp-tvac-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" /></filter>
            </defs>
            <path d={d} fill="none" stroke="#1F4FA3" strokeOpacity=".55" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            <path className="lp-tvac-run" d={d} pathLength={100} fill="none" stroke="#8AAEF0" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" filter="url(#lp-tvac-glow)" />
            <path className="lp-tvac-run" d={d} pathLength={100} fill="none" stroke="#DCE8FF" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {NODES.map((n, i) => {
              // The light's head reaches session i at this point of the cycle.
              const phase = (((i * 20 - 14) % 100) + 100) % 100 / 100;
              return (
                <g key={i} className="lp-tvac-node" style={{ "--delay": `${phase * CYCLE - CYCLE}s`, "--base": i === 5 ? "#1F4FA3" : "#0b1c33" } as React.CSSProperties}>
                  <circle cx={n.x} cy={n.y} r="27" fill={i === 5 ? "#1F4FA3" : "#0b1c33"} stroke="#5d86d6" strokeWidth="2.5" />
                  <circle className="lp-tvac-halo" cx={n.x} cy={n.y} r="27" fill="none" stroke="#8AAEF0" strokeWidth="2" />
                  <text x={n.x} y={n.y + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff" fontFamily="inherit">0{i + 1}</text>
                </g>
              );
            })}
          </svg>
          {SESSIONS.map((s, i) => {
            const n = NODES[i], top = i % 2 === 0;
            return (
              <div
                key={s.t}
                className="absolute flex w-[33%] flex-col items-center text-center"
                style={{ left: `${(n.x / PATH_W) * 100}%`, ...(top ? { bottom: `${(1 - (n.y - 36) / PATH_H) * 100}%` } : { top: `${((n.y + 36) / PATH_H) * 100}%` }), translate: "-50% 0" }}
              >
                {top ? <Tag f={s.f} /> : null}
                <b className={`text-[11px] leading-tight text-white desk:text-[13px] ${top ? "mt-1.5" : ""}`}>{s.t}</b>
                <span className="mt-0.5 text-[10px] leading-tight text-[var(--lp-muted)] desk:text-[11.5px]">{s.s}</span>
                {top ? null : <Tag f={s.f} className="mt-1.5" />}
              </div>
            );
          })}
        </div>
        {/* Phones: the same path, top to bottom. */}
        <ol className="relative mt-4 sm:hidden">
          <span className="absolute top-5 bottom-5 left-[19px] w-[2px] -translate-x-1/2 bg-[#1F4FA3]/60" aria-hidden="true">
            <span className="lp-tvac-drop" />
          </span>
          {SESSIONS.map((s, i) => (
            <li key={s.t} className="lp-tvac-row relative flex items-start gap-3 py-2" style={{ "--delay": `${(i / 5) * CYCLE - CYCLE}s`, "--base": i === 5 ? "#1F4FA3" : "#0b1c33" } as React.CSSProperties}>
              <span className="lp-tvac-dot relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#5d86d6] font-display text-[14px] font-bold text-white">0{i + 1}</span>
              <span className="min-w-0 pt-0.5">
                <b className="block text-[14px] leading-tight text-white">{s.t}</b>
                <span className="mt-0.5 block text-[12px] text-[var(--lp-muted)]">{s.s}</span>
                <Tag f={s.f} className="mt-1.5 inline-block" />
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-center text-[12px] text-[var(--lp-fg)] italic desk:text-[13px]">Closing mixer: certificates, networking, and a cohort that becomes a lasting community.</p>
      </div>
    </div>
  );
}

function Tag({ f, className }: { f: string; className?: string }) {
  return <span className={`rounded-full border border-[#1F4FA3]/60 bg-[#1F4FA3]/25 px-2 py-0.5 text-[9.5px] font-bold whitespace-nowrap text-[#C9DAFB] desk:text-[10.5px] ${className ?? ""}`}>{f}</span>;
}

function GraduationCapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}
