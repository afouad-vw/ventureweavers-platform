import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import {
  ArrowRight, ArrowUpRight, BookOpen, Briefcase, Building2, CalendarCheck, Cpu, GraduationCap, Handshake, Landmark, Library,
  Lightbulb, Linkedin, Mail, Megaphone, MessageSquare, Mic, Instagram, Rocket, Sparkles, UserPlus, Users, Youtube, type LucideIcon,
} from "lucide-react";
import { RevealOnScroll, Magnetic, NavScroll, ScrollProgress, Tilt } from "@/components/landing/fx";
import { WeaveCanvas } from "@/components/landing/weave-canvas";
import { hostConfig, SURFACE_HEADER } from "@/lib/hosts";
import "./landing.css";

export const metadata: Metadata = {
  title: { absolute: "VentureWeavers · Four spaces, one house for MENA's venture ecosystem" },
  description:
    "VentureWeavers is Ahmed Fouad and Karim Hemdan. Shows, a venture school, fractional leadership and AI for capital formation, connected by one member platform. Based in Cairo, working across MENA.",
  openGraph: {
    title: "VentureWeavers · Four spaces, one house",
    description: "Outloud, The Venture School, BRICKR and QuidQuo, connected by one member platform. Join the community.",
    images: ["/images/stage.jpg"],
  },
};

type Space = { key: string; name: string; colour: string; tint: string; kicker: string; line: string; body: string; points: string[]; cta: string; href: string; photo: string; icon: LucideIcon };

const SPACES: Space[] = [
  {
    key: "outloud",
    name: "Outloud",
    colour: "#E39B2D",
    tint: "#F2B65A",
    kicker: "Content · Shows · Events",
    line: "Real conversations, on stage and on screen.",
    body: "Open Floor is our first format: founders bring real questions, the room picks one, and we work through it together on stage. Then it lives on as episodes, reels, the VW Newsletter and VW Notes.",
    points: ["Open Floor live shows", "Episodes on YouTube", "Reels on Instagram and TikTok", "VW Newsletter and VW Notes"],
    cta: "Book a seat",
    href: "/outloud",
    photo: "/images/stage.jpg",
    icon: Mic,
  },
  {
    key: "tvs",
    name: "The Venture School",
    colour: "#1F4FA3",
    tint: "#8AAEF0",
    kicker: "Programs · Masterclasses · Classroom",
    line: "Learn it in practice. Lead it in motion.",
    body: "Programs built from real ventures, not textbooks. TVAC, The Venture Asset Class, is the foundation for every 360 program, with masterclasses and a classroom for the work in between.",
    points: ["TVAC foundation", "360 programs", "Masterclasses", "Custom programs for teams"],
    cta: "Explore programs",
    href: "/tvs",
    photo: "/images/room.jpg",
    icon: GraduationCap,
  },
  {
    key: "brickr",
    name: "BRICKR",
    colour: "#B5532F",
    tint: "#E8896A",
    kicker: "Fractional leadership",
    line: "We don't consult and leave. We build together.",
    body: "A senior partner embedded in your venture or portfolio: in the decisions, in the work, and still there after the handover. Six months for ventures, twelve for portfolios.",
    points: ["Fractional leadership", "Portfolio infrastructure", "Venture building and scaling", "Innovation hubs"],
    cta: "Request a meeting",
    href: "/brickr",
    photo: "/images/round.jpg",
    icon: Briefcase,
  },
  {
    key: "quidquo",
    name: "QuidQuo",
    colour: "#8DBF2E",
    tint: "#B4DD5E",
    kicker: "AI for capital formation · In development",
    line: "Less friction between capital and the people who need it.",
    body: "We are building AI that helps founders prepare to raise and helps investors see fit faster. Follow the build on the platform and join the waitlist to be first in.",
    points: ["Build tracker", "Waitlist", "Early access for members"],
    cta: "Join the waitlist",
    href: "/quidquo",
    photo: "/images/hands.jpg",
    icon: Cpu,
  },
];

const AUDIENCES: { icon: LucideIcon; name: string; body: string; spaces: string[] }[] = [
  { icon: Rocket, name: "Founders and ventures", body: "Bring your hardest question to Open Floor, learn how capital thinks at TVS, and build with a BRICKR partner beside you.", spaces: ["Outloud", "TVS", "BRICKR", "QuidQuo"] },
  { icon: Landmark, name: "Angel and institutional investors", body: "Sharpen your thesis with TVAC, back portfolio companies with hands-on leadership, and meet founders in the room.", spaces: ["TVS", "BRICKR", "QuidQuo"] },
  { icon: Building2, name: "Venture studios", body: "Set up the playbooks, people and portfolio infrastructure that turn one venture into many.", spaces: ["BRICKR", "TVS"] },
  { icon: Briefcase, name: "Corporates", body: "Build a venture arm, train leaders on the venture asset class, and work with the startups shaping your market.", spaces: ["TVS", "BRICKR", "Outloud"] },
  { icon: Handshake, name: "Enablers", body: "Hubs, accelerators and incubators: design programs and economics that work, and give cohorts real investment readiness.", spaces: ["BRICKR", "TVS", "Outloud"] },
  { icon: Lightbulb, name: "Experts and mentors", body: "Share what you know on stage and in the classroom, with founders who value practice over theory.", spaces: ["Outloud", "TVS"] },
];

const STEPS = [
  { n: "01", icon: UserPlus, title: "Create your account", body: "Sign up with Google, LinkedIn or email, then tell us your role in the ecosystem and what you're building. It takes about two minutes." },
  { n: "02", icon: Sparkles, title: "Step into every space", body: "Book Outloud shows, apply to TVS programs, request a BRICKR meeting and join the QuidQuo waitlist, all from one place." },
  { n: "03", icon: MessageSquare, title: "Stay close to the house", body: "Message the team, read VW Notes, open the library and share your own business news with the community." },
];

const FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: CalendarCheck, label: "Book shows" },
  { icon: GraduationCap, label: "Apply to programs" },
  { icon: Users, label: "Meet the partners" },
  { icon: Cpu, label: "QuidQuo waitlist" },
  { icon: BookOpen, label: "VW Notes" },
  { icon: Library, label: "Library" },
  { icon: MessageSquare, label: "Message the team" },
  { icon: Megaphone, label: "Share your news" },
];

const BOTS = [
  { l: "B", title: "Build", body: "Strategy, systems and assets, built with your team, not handed to it." },
  { l: "O", title: "Operate", body: "We run it together until it performs." },
  { l: "T", title: "Transfer", body: "Documented, onboarded and handed over to your people." },
  { l: "S", title: "Support", body: "We stay close as your needs change." },
];

const FOUNDERS = [
  {
    name: "Ahmed Fouad",
    photo: "/images/ahmed.jpg",
    bio: "Operator, investor and advisor. Ahmed built and ran ventures including Easy Taxi, Yumamia, Akelni, Tabibi and Toggar, invests through SeaSand CVC and DINARe Ventures, and advises founders through Sweetspot and the GLG council.",
    linkedin: "https://www.linkedin.com/in/ahmed-fouad-azm",
  },
  {
    name: "Karim Hemdan",
    photo: "/images/karim.jpg",
    bio: "Operator, investor and advisor. Karim learned the venture playbook at Rocket Internet in Berlin and ran operations at Easy Taxi, Yumamia, Jumia Group and Delivery Hero (Talabat). He invests through SeaSand CVC and DINARe Ventures and is a 500 Global VC Unlocked fellow.",
    linkedin: "https://www.linkedin.com/in/karim-hemdan",
  },
];

const words = (text: string, start = 0, cls = "") =>
  text.split(" ").map((w, i) => (
    <span key={i}>
      <span className={cls} style={{ "--i": i + start } as React.CSSProperties}>{w}&nbsp;</span>
    </span>
  ));

function Primary({ href, children, big }: { href: string; children: React.ReactNode; big?: boolean }) {
  return (
    <Magnetic
      href={href}
      className={`group inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,#3fd3b0,#29be9c)] font-bold text-ink shadow-[0_0_0_1px_rgb(255_255_255/0.2)_inset,0_10px_40px_-8px_rgb(41_190_156/0.6)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal ${big ? "h-14 px-7 text-[16px]" : "h-12 px-6 text-[15px]"}`}
    >
      {children}
      <ArrowRight size={big ? 18 : 16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
    </Magnetic>
  );
}

function Secondary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="lp-glass inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal">
      {children}
    </a>
  );
}

/** The public landing page, served at ventureweavers.com. */
export default async function SitePage() {
  const onSite = (await headers()).get(SURFACE_HEADER) === "site";
  const app = onSite ? `https://${hostConfig().app}` : "";
  const join = `${app}/join`;

  return (
    <div className="lp min-h-dvh font-sans text-[14px]">
      <RevealOnScroll />
      <NavScroll />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-ink">Skip to content</a>

      {/* ---------------------------------------------------------------- nav */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 desk:px-6">
        <div id="lp-nav" className="lp-nav mx-auto flex h-14 max-w-[1240px] items-center gap-3 rounded-2xl px-3 desk:h-16 desk:px-5">
          <a href="#top" className="flex items-center" aria-label="VentureWeavers home">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={170} height={12} priority />
          </a>
          <nav aria-label="Sections" className="ml-6 hidden gap-6 text-[13.5px] font-semibold text-[var(--lp-muted)] desk:flex">
            <a href="#spaces" className="hover:text-white">Spaces</a>
            <a href="#platform" className="hover:text-white">The platform</a>
            <a href="#who" className="hover:text-white">Who it&apos;s for</a>
            <a href="#team" className="hover:text-white">Who we are</a>
          </nav>
          <span className="flex-1" />
          <a href={`${app}/sign-in`} className="px-2 text-[13.5px] font-bold text-[var(--lp-fg)] hover:text-white">Sign in</a>
          <a href={join} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal px-4 text-[13.5px] font-bold text-ink hover:brightness-110">
            Join<span className="hidden sm:inline">the community</span>
          </a>
        </div>
      </header>

      <main id="main">
        {/* ---------------------------------------------------------------- hero */}
        <ScrollProgress as="section" id="top" exit className="relative flex min-h-[100svh] items-center overflow-hidden">
          <div className="lp-orb top-[-10%] left-[-10%] h-[50vw] w-[50vw] bg-[#02686f]" />
          <div className="lp-orb right-[-15%] bottom-[-20%] h-[45vw] w-[45vw] bg-[#1f4fa3] [animation-delay:-6s]" />
          <div className="absolute inset-0 touch-pan-y">
            <WeaveCanvas className="absolute inset-0 h-full w-full" knot={{ x: 0.72, y: 0.52 }} />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(7_17_18/0.92)_0%,rgb(7_17_18/0.6)_45%,transparent_75%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#071112] to-transparent" />

          <div className="lp-hero-copy pointer-events-none relative mx-auto w-full max-w-[1240px] px-5 pt-28 pb-24 desk:px-8">
            <span className="lp-fade-in lp-glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold text-[var(--lp-fg)]" style={{ "--delay": ".1s" } as React.CSSProperties}>
              <span className="flex gap-1" aria-hidden="true">
                {SPACES.map((s) => <span key={s.key} className="h-1.5 w-1.5 rounded-full" style={{ background: s.colour }} />)}
              </span>
              Cairo · working across MENA
            </span>
            <h1 className="lp-words mt-6 max-w-[860px] font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.01em] sm:text-[64px] desk:text-[84px]">
              {words("Where MENA's venture")}
              {words("ecosystem weaves together.", 3, "lp-grad")}
            </h1>
            <p className="lp-fade-in mt-6 max-w-[560px] text-[16px] leading-relaxed text-[var(--lp-fg)] desk:text-[18px]" style={{ "--delay": ".9s" } as React.CSSProperties}>
              Shows, a venture school, fractional leadership and AI for raising capital. Four spaces, one house, run hands-on by Ahmed Fouad and Karim Hemdan.
            </p>
            <div className="lp-fade-in pointer-events-auto mt-9 flex flex-wrap items-center gap-3" style={{ "--delay": "1.1s" } as React.CSSProperties}>
              <Primary href={join} big>Join the community</Primary>
              <Secondary href="#spaces">Explore the four spaces</Secondary>
            </div>
            <p className="lp-fade-in mt-5 text-[12.5px] text-[var(--lp-muted)]" style={{ "--delay": "1.3s" } as React.CSSProperties}>
              One account for everything. Sign up with Google, LinkedIn or email.
            </p>
          </div>

          <div className="lp-scroll-cue absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] font-bold tracking-[.2em] text-[var(--lp-muted)] uppercase desk:flex" aria-hidden="true">
            <span className="block h-8 w-px bg-gradient-to-b from-teal to-transparent" />
            Scroll · move to pull the threads
          </div>
        </ScrollProgress>

        {/* ---------------------------------------------------------------- audiences marquee */}
        <section aria-label="Who we work with" className="lp-marquee border-y border-[var(--lp-line)] py-5">
          <div className="lp-marquee-track">
            {[0, 1].map((k) => (
              <ul key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-10 pr-10 font-display text-[22px] font-semibold text-[var(--lp-muted)] desk:text-[28px]">
                {["Founders", "Angel investors", "Institutional investors", "Venture studios", "Corporates", "Hubs and accelerators", "Experts and mentors"].map((a, i) => (
                  <li key={a} className="flex items-center gap-10 whitespace-nowrap">
                    {a}
                    <span className="h-2 w-2 rounded-full" style={{ background: SPACES[i % 4].colour }} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- four spaces */}
        <section id="spaces" className="relative mx-auto max-w-[1240px] scroll-mt-24 px-5 py-24 desk:px-8 desk:py-32">
          <div className="grid gap-10 desk:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] desk:gap-16">
            <div className="desk:sticky desk:top-32 desk:self-start">
              <p className="lp-eyebrow" data-reveal>Four spaces, one house</p>
              <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                Every way in to venture, built from real practice.
              </h2>
              <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                Each space is its own thread: something to watch, something to learn, someone to build with, and a tool for raising capital. Together they make one house you can step into from any side.
              </p>
              <ul className="mt-8 hidden flex-col gap-3 desk:flex" data-reveal style={{ "--d": 3 } as React.CSSProperties}>
                {SPACES.map((s, i) => (
                  <li key={s.key}>
                    <a href={`#space-${s.key}`} className="group flex items-center gap-3 text-[14px] font-bold text-[var(--lp-muted)] hover:text-white">
                      <span className="font-display text-[12px] text-[var(--lp-muted)]">0{i + 1}</span>
                      <span className="h-px w-8 transition-all group-hover:w-14" style={{ background: s.colour }} />
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-6 pb-[6vh]">
              {SPACES.map((s, i) => (
                <ScrollProgress key={s.key} id={`space-${s.key}`} className="lp-stack-card scroll-mt-28" style={{ "--i": i } as React.CSSProperties}>
                  <div style={{ "--i": i, "--c": s.colour } as React.CSSProperties} className="lp-space">
                    <Tilt max={5} className="rounded-[28px]">
                      <article className="lp-glass overflow-hidden rounded-[28px] bg-[#0b1819]/90">
                        <div className="lp-space-photo relative h-[200px] overflow-hidden desk:h-[240px]">
                          <Image src={s.photo} alt="" fill sizes="(min-width: 900px) 640px, 100vw" className="object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1819] via-[#0b1819]/30 to-transparent" />
                          <span className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[11.5px] font-bold tracking-wide text-white backdrop-blur-md">
                            <span className="lp-space-dot h-2 w-2 rounded-full" />
                            {s.kicker}
                          </span>
                          <span className="absolute top-4 right-5 hidden font-display text-[13px] text-white/70 sm:block">0{i + 1} / 04</span>
                        </div>
                        <div className="lp-pop flex flex-col gap-3 p-6 desk:p-8">
                          <h3 className="flex items-center gap-3 font-display text-[28px] leading-tight font-semibold desk:text-[34px]">
                            <s.icon size={26} aria-hidden="true" style={{ color: s.tint }} />
                            {s.name}
                          </h3>
                          <span className="lp-space-line h-px w-24" />
                          <p className="text-[17px] font-bold text-white">{s.line}</p>
                          <p className="text-[14.5px] leading-relaxed text-[var(--lp-fg)]">{s.body}</p>
                          <ul className="mt-1 flex flex-wrap gap-2">
                            {s.points.map((pt) => (
                              <li key={pt} className="rounded-full border border-[var(--lp-line)] bg-white/[0.04] px-3 py-1 text-[12.5px] font-semibold text-[var(--lp-fg)]">{pt}</li>
                            ))}
                          </ul>
                          <a href={`${app}${s.href}`} className="group mt-3 inline-flex items-center gap-2 self-start text-[14.5px] font-bold" style={{ color: s.tint }}>
                            {s.cta}
                            <ArrowUpRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </a>
                        </div>
                      </article>
                    </Tilt>
                  </div>
                </ScrollProgress>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- the platform */}
        <ScrollProgress as="section" id="platform" className="relative scroll-mt-24 overflow-hidden border-t border-[var(--lp-line)] py-24 desk:py-32">
          <div className="lp-orb top-[20%] left-[30%] h-[40vw] w-[40vw] bg-[#02686f] opacity-30" />
          <div className="relative mx-auto max-w-[1240px] px-5 desk:px-8">
            <div className="mx-auto max-w-[760px] text-center">
              <p className="lp-eyebrow" data-reveal>The member platform</p>
              <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[56px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                One account. <span className="lp-grad">The whole house.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[580px] text-[15.5px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                No scattered forms or mailing lists. Your VentureWeavers account is your direct line to our shows, programs, partners and the people in the community.
              </p>
            </div>

            {/* A glass preview of the member app, built in markup (not an image). */}
            <div className="lp-mock relative mx-auto mt-14 max-w-[1000px]" data-reveal>
              <div className="lp-glass overflow-hidden rounded-[22px]">
                <div className="flex items-center gap-1.5 border-b border-[var(--lp-line)] px-4 py-3">
                  {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full opacity-70" style={{ background: c }} />)}
                  <span className="ml-3 rounded-md bg-white/5 px-3 py-1 text-[11.5px] text-[var(--lp-muted)]">app.ventureweavers.com</span>
                </div>
                <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[190px_1fr]">
                  <div className="flex flex-col gap-1 border-r border-[var(--lp-line)] bg-black/25 p-3 text-[12px]">
                    <span className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-teal" /><b className="text-[12.5px]">Home</b></span>
                    {[["Content", "Outloud", "#E39B2D"], ["Education", "TVS", "#1F4FA3"], ["Services", "BRICKR", "#B5532F"], ["Technology", "QuidQuo", "#8DBF2E"], ["Resources", "Library", "#29BE9C"]].map(([type, name, c]) => (
                      <span key={name} className="flex flex-col rounded-lg px-2 py-1.5 hover:bg-white/5">
                        <span className="text-[9.5px] font-bold tracking-wider text-white/35 uppercase">{type}</span>
                        <span className="flex items-center gap-2 font-semibold text-[var(--lp-fg)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{name}</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <b className="font-display text-[17px] sm:text-[20px]">Good evening, Laila</b>
                      <span className="hidden rounded-full bg-white/5 px-3 py-1 text-[11px] text-[var(--lp-muted)] sm:inline">Search</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { c: "#E39B2D", t: "Open Floor · Show 02", s: "Your seat is confirmed", img: "/images/show.jpg" },
                        { c: "#1F4FA3", t: "TVAC", s: "Application in review", img: "/images/room.jpg" },
                        { c: "#B5532F", t: "BRICKR meeting", s: "Thursday, 11:00 Cairo", img: "/images/round.jpg" },
                      ].map((x) => (
                        <div key={x.t} className="overflow-hidden rounded-xl border border-[var(--lp-line)] bg-white/[0.03]">
                          <div className="relative h-16 sm:h-20"><Image src={x.img} alt="" fill sizes="220px" className="object-cover opacity-80" /></div>
                          <div className="p-2.5">
                            <span className="mb-1 block h-0.5 w-6 rounded" style={{ background: x.c }} />
                            <b className="block truncate text-[12.5px]">{x.t}</b>
                            <span className="block truncate text-[11px] text-[var(--lp-muted)]">{x.s}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden items-center gap-3 rounded-xl border border-[var(--lp-line)] bg-white/[0.03] p-3 sm:flex">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8DBF2E]/20 text-[#8DBF2E]"><Cpu size={15} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><b className="block text-[12.5px]">QuidQuo</b><span className="block text-[11px] text-[var(--lp-muted)]">You&apos;re on the waitlist. We&apos;ll let you in early.</span></span>
                      <span className="rounded-full bg-teal/15 px-2.5 py-1 text-[11px] font-bold text-teal">Waitlist</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute -inset-x-10 -bottom-10 h-24 bg-[radial-gradient(ellipse_at_center,rgb(41_190_156/0.25),transparent_70%)] blur-2xl" />
            </div>

            <ol className="mt-16 grid gap-4 desk:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.n} data-reveal style={{ "--d": i } as React.CSSProperties}>
                  <Tilt className="h-full rounded-[22px]" max={6}>
                    <div className="lp-glass flex h-full flex-col gap-3 rounded-[22px] p-6">
                      <span className="flex items-center justify-between">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/15 text-teal"><s.icon size={20} aria-hidden="true" /></span>
                        <span className="font-display text-[34px] font-semibold text-white/10">{s.n}</span>
                      </span>
                      <h3 className="font-display text-[20px] font-semibold">{s.title}</h3>
                      <p className="text-[14px] leading-relaxed text-[var(--lp-fg)]">{s.body}</p>
                    </div>
                  </Tilt>
                </li>
              ))}
            </ol>

            <ul className="mt-10 flex flex-wrap justify-center gap-2" data-reveal aria-label="Inside your account">
              {FEATURES.map((f) => (
                <li key={f.label} className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-line)] bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-[var(--lp-fg)]">
                  <f.icon size={15} aria-hidden="true" className="text-teal" />
                  {f.label}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex justify-center" data-reveal>
              <Primary href={join}>Create your account</Primary>
            </div>
          </div>
        </ScrollProgress>

        {/* ---------------------------------------------------------------- who it's for */}
        <section id="who" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-24 desk:px-8 desk:py-32">
          <div className="flex flex-col gap-4 desk:flex-row desk:items-end desk:justify-between">
            <div className="max-w-[640px]">
              <p className="lp-eyebrow" data-reveal>Who it&apos;s for</p>
              <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                One ecosystem. A place for every stakeholder.
              </h2>
            </div>
            <p className="max-w-[380px] text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
              Raising your next round, allocating capital or running an accelerator: there is a clear way in for you.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 desk:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <div key={a.name} data-reveal style={{ "--d": i % 3 } as React.CSSProperties}>
                <Tilt className="h-full rounded-[22px]" max={7}>
                  <article className="lp-glass group flex h-full flex-col gap-3 rounded-[22px] p-6 transition-colors hover:bg-white/[0.06]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--lp-line)] bg-white/[0.04] text-teal transition-transform group-hover:scale-110"><a.icon size={20} aria-hidden="true" /></span>
                    <h3 className="font-display text-[19px] font-semibold">{a.name}</h3>
                    <p className="flex-1 text-[14px] leading-relaxed text-[var(--lp-fg)]">{a.body}</p>
                    <span className="flex flex-wrap gap-1.5">
                      {a.spaces.map((sp) => {
                        const c = SPACES.find((s) => s.name === sp || s.key === sp.toLowerCase())?.colour ?? "#29BE9C";
                        return <span key={sp} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--lp-fg)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{sp}</span>;
                      })}
                    </span>
                  </article>
                </Tilt>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- BRICKR approach */}
        <ScrollProgress as="section" className="relative overflow-hidden border-y border-[var(--lp-line)] bg-[#0a1617] py-24 desk:py-32">
          <div className="mx-auto max-w-[1240px] px-5 desk:px-8">
            <div className="grid gap-6 desk:grid-cols-2 desk:items-end">
              <div>
                <p className="lp-eyebrow" style={{ color: "#e07a55" }} data-reveal>BRICKR · How we work</p>
                <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                  We don&apos;t consult and leave. <span className="text-[#e07a55]">We build together.</span>
                </h2>
              </div>
              <p className="text-[15px] leading-relaxed text-[var(--lp-fg)] desk:pb-2" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                Typical advisory ends with a report and leaves the execution to you. A BRICKR partner sits in the decisions, does the work with your team, and is measured by what it produces, not by hours.
              </p>
            </div>
            <div className="relative mt-14">
              <div className="absolute top-0 bottom-0 left-[27px] w-px bg-white/10 desk:top-[27px] desk:right-0 desk:bottom-auto desk:left-0 desk:h-px desk:w-auto" aria-hidden="true">
                <div className="lp-track-fill h-full w-full bg-gradient-to-b from-[#B5532F] to-[#e3a57f] desk:bg-gradient-to-r" />
              </div>
              <ol className="relative grid gap-8 desk:grid-cols-4 desk:gap-6">
                {BOTS.map((b, i) => (
                  <li key={b.l} className="flex gap-5 desk:flex-col desk:gap-4" data-reveal style={{ "--d": i } as React.CSSProperties}>
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#B5532F]/50 bg-[#1a0f0b] font-display text-[22px] font-semibold text-[#e3a57f] shadow-[0_0_30px_-6px_#B5532F]">{b.l}</span>
                    <span>
                      <span className="text-[11px] font-extrabold tracking-[.16em] text-white/40 uppercase">Step 0{i + 1}</span>
                      <h3 className="mt-1 font-display text-[22px] font-semibold">{b.title}</h3>
                      <p className="mt-1.5 max-w-[280px] text-[14px] leading-relaxed text-[var(--lp-fg)]">{b.body}</p>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-12" data-reveal>
              <Secondary href={`${app}/brickr`}>Request a meeting <ArrowRight size={16} aria-hidden="true" /></Secondary>
            </div>
          </div>
        </ScrollProgress>

        {/* ---------------------------------------------------------------- Outloud: Open Floor */}
        <section className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 desk:grid-cols-2 desk:items-center desk:gap-16 desk:px-8 desk:py-32">
          <div className="relative h-[420px] desk:h-[560px]">
            <ScrollProgress className="lp-parallax absolute top-0 left-0 h-[72%] w-[78%] overflow-hidden rounded-[26px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
              <Image src="/images/show.jpg" alt="An Open Floor show in Cairo" fill sizes="(min-width: 900px) 480px, 80vw" className="object-cover" />
            </ScrollProgress>
            <ScrollProgress className="lp-parallax absolute right-0 bottom-0 h-[52%] w-[58%] overflow-hidden rounded-[26px] border-4 border-[#071112] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] [--shift:-110px]">
              <Image src="/images/crowd.jpg" alt="The audience at an Open Floor show" fill sizes="(min-width: 900px) 360px, 60vw" className="object-cover" />
            </ScrollProgress>
            <span className="lp-glass absolute bottom-[34%] left-[6%] inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-bold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#E39B2D]" /> The room picks the question
            </span>
          </div>
          <div>
            <p className="lp-eyebrow" style={{ color: "#E39B2D" }} data-reveal>Outloud · Open Floor</p>
            <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
              No scripts. Real founder questions.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
              Most startup events are rehearsed panels. Open Floor turns the room into a working session.
            </p>
            <ol className="mt-8 flex flex-col gap-5">
              {[
                ["Founders bring real questions", "Pricing, co-founder splits, a term sheet, a new market. Whatever is keeping them up."],
                ["The room picks one", "The audience chooses the question that matters most, live."],
                ["We work through it on stage", "Ahmed, Karim and the founder unpack it together and leave with a decision."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4" data-reveal style={{ "--d": i + 2 } as React.CSSProperties}>
                  <span className="font-display text-[15px] font-semibold text-[#E39B2D]">0{i + 1}</span>
                  <span><b className="block text-[16px]">{t}</b><span className="text-[14px] text-[var(--lp-fg)]">{b}</span></span>
                </li>
              ))}
            </ol>
            <div className="mt-9 flex flex-wrap gap-3" data-reveal>
              <Secondary href={`${app}/outloud`}>See upcoming shows <ArrowRight size={16} aria-hidden="true" /></Secondary>
              <a href="https://www.youtube.com/@Venture_Weavers" target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 px-2 text-[14.5px] font-bold text-[var(--lp-fg)] hover:text-white">
                <Youtube size={18} aria-hidden="true" /> Watch episodes
              </a>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- founders */}
        <section id="team" className="scroll-mt-24 border-t border-[var(--lp-line)] bg-[#0a1617] py-24 desk:py-32">
          <div className="mx-auto max-w-[1240px] px-5 desk:px-8">
            <div className="max-w-[680px]">
              <p className="lp-eyebrow" data-reveal>Who we are</p>
              <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                Two operators. Built in Cairo, working across MENA.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                We bring our experience, knowledge and access to the people building MENA&apos;s venture ecosystem. Every space is run hands-on by the two of us.
              </p>
            </div>
            <div className="mt-12 grid gap-5 desk:grid-cols-2">
              {FOUNDERS.map((f, i) => (
                <div key={f.name} data-reveal style={{ "--d": i } as React.CSSProperties}>
                  <Tilt className="rounded-[26px]" max={5}>
                    <article className="lp-glass flex flex-col overflow-hidden rounded-[26px] sm:flex-row">
                      <div className="relative aspect-[4/3] sm:aspect-auto sm:w-[44%]">
                        <Image src={f.photo} alt={f.name} fill sizes="(min-width: 900px) 260px, 100vw" className="object-cover object-top" />
                      </div>
                      <div className="lp-pop flex flex-1 flex-col gap-2 p-6">
                        <span className="text-[11px] font-extrabold tracking-[.16em] text-teal uppercase">Co-founder and partner</span>
                        <h3 className="font-display text-[24px] font-semibold">{f.name}</h3>
                        <p className="text-[14px] leading-relaxed text-[var(--lp-fg)]">{f.bio}</p>
                        <a href={f.linkedin} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[13.5px] font-bold text-teal hover:underline">
                          <Linkedin size={15} aria-hidden="true" /> LinkedIn
                        </a>
                      </div>
                    </article>
                  </Tilt>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- closing call to action */}
        <section className="relative overflow-hidden py-28 desk:py-40">
          <div className="absolute inset-0 opacity-70">
            <WeaveCanvas className="absolute inset-0 h-full w-full" knot={{ x: 0.5, y: 0.5 }} intensity={0.6} />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(7_17_18/0.55),#071112_75%)]" />
          <div className="pointer-events-none relative mx-auto flex max-w-[860px] flex-col items-center px-5 text-center">
            <h2 className="font-display text-[40px] leading-[1.02] font-semibold desk:text-[72px]" data-reveal>
              Step inside <span className="lp-grad">the house.</span>
            </h2>
            <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
              Join founders, investors and builders across MENA. One account opens Outloud shows, TVS programs, meetings with the partners, the QuidQuo waitlist, VW Notes and the library.
            </p>
            <div className="pointer-events-auto mt-10 flex flex-wrap justify-center gap-3" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
              <Primary href={join} big>Join the community</Primary>
              <Secondary href={`${app}/brickr`}>Request a meeting</Secondary>
            </div>
            <p className="pointer-events-auto mt-6 text-[13px] text-[var(--lp-muted)]" data-reveal style={{ "--d": 3 } as React.CSSProperties}>
              Already a member? <a href={`${app}/sign-in`} className="font-bold text-teal hover:underline">Sign in</a>
            </p>
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------------- footer */}
      <footer className="border-t border-[var(--lp-line)] bg-[#050d0e] text-[var(--lp-muted)]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 sm:grid-cols-2 desk:grid-cols-[1.4fr_1fr_1fr_1fr] desk:px-8">
          <div className="flex flex-col gap-4">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={170} height={12} />
            <p className="max-w-[300px] text-[13.5px] leading-relaxed">Experience, knowledge and access to MENA&apos;s venture ecosystem. Four spaces, one member platform.</p>
            <span className="text-[13px]">Cairo · working across MENA</span>
          </div>
          <nav aria-label="Spaces" className="flex flex-col gap-2.5 text-[13.5px]">
            <b className="mb-1 text-[11px] tracking-[.16em] text-white uppercase">Spaces</b>
            {SPACES.map((s) => <a key={s.key} href={`${app}${s.href}`} className="hover:text-white">{s.name}</a>)}
          </nav>
          <nav aria-label="Platform" className="flex flex-col gap-2.5 text-[13.5px]">
            <b className="mb-1 text-[11px] tracking-[.16em] text-white uppercase">Platform</b>
            <a href={join} className="hover:text-white">Create an account</a>
            <a href={`${app}/sign-in`} className="hover:text-white">Sign in</a>
            <a href={`${app}/privacy`} className="hover:text-white">Privacy Policy</a>
            <a href={`${app}/terms`} className="hover:text-white">Terms of Use</a>
          </nav>
          <div className="flex flex-col gap-2.5 text-[13.5px]">
            <b className="mb-1 text-[11px] tracking-[.16em] text-white uppercase">Connect</b>
            <a href="mailto:info@ventureweavers.com" className="inline-flex items-center gap-2 hover:text-white"><Mail size={15} aria-hidden="true" />info@ventureweavers.com</a>
            <a href="https://www.linkedin.com/company/ventureweavers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white"><Linkedin size={15} aria-hidden="true" />LinkedIn</a>
            <a href="https://www.instagram.com/ventureweavers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white"><Instagram size={15} aria-hidden="true" />Instagram</a>
            <a href="https://www.youtube.com/@Venture_Weavers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white"><Youtube size={15} aria-hidden="true" />YouTube</a>
          </div>
        </div>
        <div className="border-t border-[var(--lp-line)]">
          <p className="mx-auto max-w-[1240px] px-5 py-5 text-[12.5px] desk:px-8">© {new Date().getFullYear()} VentureWeavers. Cairo · MENA.</p>
        </div>
      </footer>
    </div>
  );
}
