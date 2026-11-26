import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import {
  ArrowRight, ArrowUpRight, BellRing, BookOpen, Briefcase, Building2, CalendarCheck, Compass, Cpu, GraduationCap, Handshake, Landmark, Library,
  Lightbulb, Linkedin, Mail, Megaphone, MessageCircleQuestion, MessageSquare, Mic, Instagram, QrCode, Rocket, Route, Shuffle, Sparkles,
  UserPlus, Users, MessagesSquare, Network, Youtube, type LucideIcon,
} from "lucide-react";
import { HScroll, LitStatement, RevealOnScroll, Magnetic, NavScroll, ScrollProgress, StackDeck, Tilt } from "@/components/landing/fx";
import { LogoWeave, OpenFloorStage, TvacRoom } from "@/components/landing/open-floor";
import { FloatingScene, Journey, type FlowPath, type Hotspot, type JourneyStep } from "@/components/landing/scene";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { FounderReadMore, type Founder } from "@/components/landing/founder-bio";
import { hostConfig, SURFACE_HEADER } from "@/lib/hosts";
import "./landing.css";

const SITE_URL = `https://${hostConfig().site}`;
const TITLE = "VentureWeavers | One house for MENA's venture ecosystem";
const DESCRIPTION =
  "Shows, venture education, fractional leadership, a products lab building AI tools and a member community from Ahmed Fouad and Karim Hemdan, in Cairo, across MENA.";
const SHARE_IMAGE = { url: "/images/og-logo.png", width: 1200, height: 630, alt: "VentureWeavers", type: "image/png" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: "VentureWeavers",
  authors: [{ name: "Ahmed Fouad" }, { name: "Karim Hemdan" }],
  creator: "VentureWeavers",
  publisher: "VentureWeavers",
  category: "Business",
  keywords: [
    "VentureWeavers", "MENA venture ecosystem", "Cairo startups", "Egypt venture capital", "venture building", "fractional leadership",
    "startup mentorship", "venture education", "The Venture School", "Open Floor", "Outloud", "BRICKR", "Eureka", "QuidQuo", "Handlr", "BLong", "founder community", "capital formation", "angel investing",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "VentureWeavers",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [SHARE_IMAGE] },
};

/** Structured data for search engines: the organisation, its founders and the website. */
function jsonLd(founders: Founder[]) {
  const org = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: "VentureWeavers",
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/icon-512.png`, width: 512, height: 512 },
        image: `${SITE_URL}/images/og-logo.png`,
        description: DESCRIPTION,
        email: "info@ventureweavers.com",
        address: { "@type": "PostalAddress", addressLocality: "Cairo", addressCountry: "EG" },
        areaServed: "Middle East and North Africa",
        founders: founders.map((f) => ({ "@type": "Person", name: f.name, jobTitle: f.role, sameAs: [f.linkedin] })),
        sameAs: ["https://www.linkedin.com/company/ventureweavers", "https://www.instagram.com/ventureweavers", "https://www.youtube.com/@Venture_Weavers"],
      },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: "VentureWeavers", inLanguage: "en", publisher: { "@id": org } },
    ],
  };
}

type Space = { key: string; name: string; colour: string; tint: string; kicker: string; line: string; body: string; points: string[]; cta: string; href: string; photo: string; size: [number, number]; labels: { label: string; x: number; y: number }[]; flows: [number, number][][]; icon: LucideIcon };

const SPACES: Space[] = [
  {
    key: "outloud",
    name: "Outloud",
    colour: "#E39B2D",
    tint: "#F2B65A",
    kicker: "Content · Live and digital",
    line: "Live in the room. Shared on screen.",
    body: "The conversations we have in public. Live formats bring founders, investors and operators into one room to share real stories and work through real questions. Digital content carries those conversations across MENA, in episodes, short reels, VW Notes and the VW Newsletter.",
    points: ["Live shows and events", "Private sessions for partners", "Episodes on YouTube", "Reels on Instagram and TikTok", "VW Notes", "VW Newsletter"],
    cta: "Explore content",
    href: "/outloud",
    photo: "/landing/stage.webp",
    size: [1800, 1525],
    labels: [{ label: "Live", x: 42, y: 27 }, { label: "The room", x: 74, y: 46 }],
    flows: [[[6.3, 60.2], [45.8, 85.1]], [[6.6, 60.6], [13, 63.2], [16, 63.4], [27, 57.4]], [[27.2, 57.8], [18.5, 63], [17.6, 65.5], [19, 67], [37, 78.6]]],
    icon: Mic,
  },
  {
    key: "tvs",
    name: "The Venture School",
    colour: "#1F4FA3",
    tint: "#8AAEF0",
    kicker: "Education · Practical and dynamic",
    line: "Learn it in practice. Lead it in motion.",
    body: "Practical, dynamic education for every seat at the table: founders, angels, mentors, intrapreneurs and career professionals. Each topic is taught from every stakeholder's side, through role play, real case studies and guest practitioners, so you leave with frameworks you use the next day. Our flagship program, The Venture Asset Class – Beyond Technicalities, is coming soon.",
    points: ["Flagship: The Venture Asset Class · coming soon", "Programs and bootcamps", "Masterclasses", "Workshops", "Open cohorts", "Programs for teams and partners"],
    cta: "Explore programs",
    href: "/tvs",
    photo: "/landing/classroom.webp",
    size: [1800, 1397],
    labels: [{ label: "Programs", x: 76, y: 17 }, { label: "Masterclasses", x: 47, y: 45 }],
    flows: [[[10, 55.3], [36.5, 73.3], [38.6, 74.2], [41, 73.7], [48.3, 70]]],
    icon: GraduationCap,
  },
  {
    key: "brickr",
    name: "BRICKR",
    colour: "#B5532F",
    tint: "#E8896A",
    kicker: "Services · Fractional leadership & mentorship",
    line: "We don't consult and leave. We build together.",
    body: "Two ways to work with us. Fractional leadership puts experienced partners inside your venture or portfolio: in the decisions, in the work, and measured by what it produces, not by hours of advice. Mentorship gives founders and portfolios personal, output-oriented sessions that end in decisions and actions, tracked to completion.",
    points: ["Fractional leadership", "Mentorship for ventures", "Mentorship for portfolios", "Venture building and scaling", "Portfolio infrastructure", "Innovation hubs"],
    cta: "Request a meeting",
    href: "/brickr",
    photo: "/landing/workshop.webp",
    size: [1425, 1397],
    labels: [{ label: "Lead", x: 40.6, y: 38 }, { label: "Mentor", x: 76, y: 48 }],
    flows: [[[9.6, 64.4], [33, 77.9]], [[31.1, 80.7], [48.8, 71]]],
    icon: Briefcase,
  },
  {
    key: "quidquo",
    name: "Eureka",
    colour: "#7C5CE0",
    tint: "#B4A2F5",
    kicker: "Products · Our lab",
    line: "Where we build our own products, in the open.",
    body: "Eureka is the VentureWeavers products lab. QuidQuo is AI for capital formation, for founders and investors alike. Handlr is an AI executive assistant for professionals and businesses. Follow each build on the platform and join its waitlist to be first in.",
    points: ["QuidQuo", "Handlr", "Build trackers", "Early access for members"],
    cta: "Join a waitlist",
    href: "/eureka",
    photo: "/landing/lab.webp",
    size: [1800, 1442],
    labels: [{ label: "QuidQuo", x: 72, y: 22 }, { label: "Handlr", x: 30, y: 30 }],
    flows: [[[0, 94.6], [36, 70], [37.6, 68.4], [48, 61.6]]],
    icon: Cpu,
  },
  {
    key: "blong",
    name: "BLong",
    colour: "#8DBF2E",
    tint: "#B4DD5E",
    kicker: "Community · Engage and connect",
    line: "Where members meet, talk and grow together.",
    body: "The community space, run by the members themselves. Find people across the ecosystem and follow them, start or join communities around a topic, an industry, a role or a place, and talk things through in live discussions. Every member chooses who can follow them, message them and see what they do.",
    points: ["Member networking", "Follow and message members", "Communities", "Live discussions", "A feed from people you follow", "Public or private profile"],
    cta: "Meet the community",
    href: "/blong/networking",
    photo: "/landing/blong.webp",
    size: [2000, 1750],
    labels: [{ label: "Meet", x: 20, y: 30 }, { label: "Talk", x: 50, y: 14 }, { label: "Connect", x: 82, y: 32 }],
    flows: [],
    icon: Network,
  },
];

const AUDIENCES: { icon: LucideIcon; name: string; body: string }[] = [
  { icon: Rocket, name: "Founders and ventures", body: "Bring your hardest question to Open Floor, learn how capital thinks at TVS, and build with a BRICKR partner or mentor beside you." },
  { icon: Landmark, name: "Angel and institutional investors", body: "Sharpen your thesis with TVAC, back portfolio companies with hands-on leadership, and meet founders in the room." },
  { icon: Building2, name: "Venture studios", body: "Set up the playbooks, people and portfolio infrastructure that turn one venture into many." },
  { icon: Briefcase, name: "Corporates", body: "Build a venture arm, train leaders on the venture asset class, and work with the startups shaping your market." },
  { icon: Handshake, name: "Enablers", body: "Hubs, accelerators and incubators: design programs and economics that work, and give cohorts real investment readiness." },
  { icon: Lightbulb, name: "Experts and mentors", body: "Share what you know on stage and in the classroom, with founders who value practice over theory." },
  { icon: Route, name: "Career professionals", body: "Bring your experience into venture as a founder, angel, mentor, operator or enabler. Get the map of the ecosystem and find the role that fits you." },
  { icon: Compass, name: "Ecosystem newcomers", body: "New to venture? Learn how the ecosystem works and who is in it, hear real stories from every side of the table, and find your place." },
];

const STEPS = [
  { n: "01", icon: UserPlus, title: "Create your account", body: "Sign up with Google, LinkedIn or email, then tell us your role in the ecosystem and what you're building. It takes about two minutes." },
  { n: "02", icon: Sparkles, title: "Step into every space", body: "Book Outloud shows, apply to TVS programs, request a BRICKR meeting, join a Eureka product waitlist and meet members in BLong, all from one place." },
  { n: "03", icon: MessageSquare, title: "Stay close to the house", body: "Message the team, read VW Notes, open the library and share your own business news with the community." },
];

const FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: CalendarCheck, label: "Book shows" },
  { icon: GraduationCap, label: "Apply to programs" },
  { icon: Users, label: "Meet the partners" },
  { icon: Cpu, label: "Eureka waitlists" },
  { icon: Network, label: "Communities and discussions" },
  { icon: BookOpen, label: "VW Notes" },
  { icon: Library, label: "Library" },
  { icon: MessageSquare, label: "Message the team" },
  { icon: Megaphone, label: "Share your news" },
];

const HOUSE_SPOTS: Hotspot[] = [
  { label: "Outloud", x: 21.4, y: 4, colour: "#E39B2D", href: "#space-outloud" },
  { label: "The Venture School", x: 79.9, y: 4, colour: "#1F4FA3", href: "#space-tvs" },
  { label: "Eureka", x: 13.3, y: 53.5, colour: "#7C5CE0", href: "#space-quidquo" },
  { label: "BRICKR", x: 82.7, y: 53.5, colour: "#B5532F", href: "#space-brickr" },
  { label: "BLong", x: 48, y: 47, colour: "#8DBF2E", href: "#space-blong" },
];

// The teal threads on the house floors, traced from the image (in % of it).
const HOUSE_FLOWS: FlowPath[] = [
  { colour: "#29BE9C", points: [[31.8, 45.3], [42, 39.5], [46, 35.6], [47.7, 33.6]] },
  { colour: "#29BE9C", points: [[64.8, 45.5], [56, 40.2], [51.6, 35.6], [50.2, 34.4]] },
  { colour: "#29BE9C", points: [[29.3, 86.2], [33, 87.9], [35.5, 87.6], [46, 79.5], [48.4, 78.2]] },
  { colour: "#29BE9C", points: [[70.5, 83.9], [66, 87.4], [64, 87.6], [51, 79.3], [48.4, 78.2]] },
  { colour: "#29BE9C", points: [[37.9, 71], [48.4, 78.2], [58.6, 84.8]] },
  { colour: "#29BE9C", points: [[37.7, 84.7], [48.4, 78.2], [58.4, 70.7]] },
];

const JOURNEY = (app: string, join: string): JourneyStep[] => [
  { key: "in", tab: "Join", kicker: "The way in", title: "Create your account", body: "One account opens every space. Sign up with Google, LinkedIn or email and tell us where you are in the ecosystem.", cta: { label: "Join the community", href: join }, colour: "#29BE9C", tint: "#5fe0c0", cam: { x: 17.5, y: 50, s: 2.9 }, label: { x: 26, y: 28 } },
  { key: "outloud", tab: "Outloud", kicker: "Content · Live and digital", title: "Conversations worth having in public", body: "Outloud is our content space. Live shows and events bring the ecosystem into one room; episodes, reels, VW Notes and the VW Newsletter carry the conversation further.", cta: { label: "Explore content", href: `${app}/outloud` }, colour: "#E39B2D", tint: "#F2B65A", cam: { x: 24.6, y: 37, s: 3.3 }, label: { x: 50, y: 22 } },
  { key: "tvs", tab: "TVS", kicker: "Education", title: "Learn it in practice", body: "The Venture School is practical, dynamic education for every stakeholder of the ecosystem. Our flagship program, The Venture Asset Class – Beyond Technicalities, is coming soon.", cta: { label: "Explore programs", href: `${app}/tvs` }, colour: "#1F4FA3", tint: "#8AAEF0", cam: { x: 39.5, y: 47, s: 3.3 }, label: { x: 50, y: 22 } },
  { key: "brickr", tab: "BRICKR", kicker: "Services", title: "Build it together", body: "BRICKR is fractional leadership and mentorship. Experienced partners work inside your venture or portfolio, or mentor you through the decisions that matter, hands-on, not hands-off.", cta: { label: "Request a meeting", href: `${app}/brickr` }, colour: "#B5532F", tint: "#E8896A", cam: { x: 52.5, y: 37, s: 3.3 }, label: { x: 50, y: 22 } },
  { key: "quidquo", tab: "Eureka", kicker: "Products lab", title: "Products we build in the open", body: "Eureka is our products lab. QuidQuo is AI for capital formation; Handlr is an AI executive assistant for professionals and businesses. Follow each build and join its waitlist to be first in.", cta: { label: "See the products", href: `${app}/eureka` }, colour: "#7C5CE0", tint: "#B4A2F5", cam: { x: 65.5, y: 49, s: 3.3 }, label: { x: 50, y: 22 } },
  { key: "blong", tab: "BLong", kicker: "Community", title: "Meet the people building it", body: "BLong is the community space. Follow members across the ecosystem, join communities around what you care about, and talk it through in live discussions, on your own terms.", cta: { label: "Meet the community", href: `${app}/blong/networking` }, colour: "#8DBF2E", tint: "#B4DD5E", cam: { x: 84, y: 42, s: 2.3 }, label: { x: 50, y: 20 } },
];

const FOUNDERS: Founder[] = [
  {
    name: "Ahmed Fouad",
    role: "Founding Partner",
    photo: "/landing/ahmed.webp",
    short: "Ahmed Fouad, Founding Partner of VentureWeavers, is a venture builder and ecosystem enabler with 15 years of diverse, cross-functional experience across venture building, investment management and consulting. He operated in multiple ventures, co-founded Sweetspot Consulting, and served as Managing Partner of DINARe Ventures, evaluating more than 300 ventures.",
    long: [
      "Ahmed Fouad is a Founding Partner of VentureWeavers, based in Cairo. A venture builder and ecosystem enabler, he brings 15 years of diverse, cross-functional experience across venture building, investment management and consulting. He began as a mechanical and production engineer in paper and plastic manufacturing, then moved into consulting with ADS Consulting and Solutions Consulting, while assisting a professor on master's programmes at several universities.",
      "He operated inside ventures that later went through M&A, including Easy Taxi, Yumamia, Akelni and Tabibi. He co-founded Sweetspot Consulting, later acqui-hired by SeaSand Shipping, and served as Managing Partner of DINARe Ventures. Along the way he has evaluated more than 300 ventures, advised over 50, participated in two exits, founded two ventures and developed three educational programmes.",
      "Today he leads product architecture and AI workflow design at VentureWeavers, turning frameworks into working systems. He sits on the GLG council and is a member of Empower Africa.",
    ],
    linkedin: "https://www.linkedin.com/in/ahmed-fouad-azm",
  },
  {
    name: "Karim Hemdan",
    role: "Founding Partner",
    photo: "/landing/karim.webp",
    short: "Karim Hemdan is a Founding Partner of VentureWeavers. Over 15+ years he moved from telecom engineering to Rocket Internet's venture playbook, then operated inside Easy Taxi, Yumamia, Jumia and Delivery Hero/Talabat across Egypt, Nigeria, Kenya and Central MENA. He later co-founded Sweetspot Consulting and led DINARe Ventures as Managing Partner.",
    long: [
      "Karim Hemdan is a Founding Partner of VentureWeavers, based in Cairo. He began in RF and telecom engineering, then joined Rocket Internet in Berlin and moved into Easy Taxi as Entrepreneur in Residence. Over the following decade he operated inside ventures that went on to an IPO or M&A: leading logistics and fulfilment at Yumamia, strategic projects and logistics expansion at Jumia Group across Egypt, Nigeria and Kenya, and expansion across Egypt and Central MENA at Delivery Hero/Talabat.",
      "He co-founded Sweetspot Consulting, later acqui-hired by SeaSand Shipping, where as CVC Director he launched the venture studio that spun out as DINARe Ventures, which he led as Managing Partner.",
      "He is an alumnus of 500 Global VCU, Angel School and Morrow/GSSN, sits on four boards, judges for Founder Institute MENA, and was selected for the Swedish Institute's Impact Pioneers '26 programme. He works as a strategist, investor, operator and ecosystem enabler.",
    ],
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(FOUNDERS)).replace(/</g, "\\u003c") }} />
      <RevealOnScroll />
      <SmoothScroll />
      <NavScroll />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-ink">Skip to content</a>

      {/* ---------------------------------------------------------------- nav */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 desk:px-6">
        <div id="lp-nav" className="lp-nav mx-auto flex h-14 max-w-[1240px] items-center gap-3 rounded-2xl px-3 desk:h-16 desk:px-5">
          <a href="#top" className="flex items-center" aria-label="VentureWeavers home">
            <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={170} height={12} priority />
          </a>
          <nav aria-label="Sections" className="ml-6 hidden gap-6 text-[13.5px] font-semibold text-[var(--lp-muted)] desk:flex">
            <a href="#journey" className="hover:text-white">The house</a>
            <a href="#spaces" className="hover:text-white">Spaces</a>
            <a href="#platform" className="hover:text-white">The platform</a>
            <a href="#who" className="hover:text-white">Who it&apos;s for</a>
            <a href="#flagships" className="hover:text-white">Flagships</a>
            <a href="#team" className="hover:text-white">Who we are</a>
          </nav>
          <span className="flex-1" />
          <a href={join} className="inline-flex h-10 items-center rounded-full bg-teal px-5 text-[13.5px] font-bold text-ink hover:brightness-110">Sign up</a>
        </div>
      </header>

      <main id="main">
        {/* ---------------------------------------------------------------- hero */}
        <ScrollProgress as="section" id="top" exit className="relative flex min-h-[100svh] items-center overflow-hidden">
          <div className="lp-orb top-[-15%] left-[-10%] h-[50vw] w-[50vw] bg-[#02686f]" />
          <div className="lp-orb right-[-10%] bottom-[-25%] h-[40vw] w-[40vw] bg-[#1f4fa3] opacity-30 [animation-delay:-6s]" />
          <div className="relative mx-auto grid w-full max-w-[1320px] items-center gap-6 px-5 pt-28 pb-16 desk:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] desk:gap-4 desk:px-8">
            <div className="lp-hero-copy relative z-10">
              <span className="lp-fade-in lp-glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold text-[var(--lp-fg)]" style={{ "--delay": ".1s" } as React.CSSProperties}>
                <span className="flex gap-1" aria-hidden="true">
                  {SPACES.map((sp) => <span key={sp.key} className="h-1.5 w-1.5 rounded-full" style={{ background: sp.colour }} />)}
                </span>
                Cairo · working across MENA
              </span>
              <h1 className="lp-words mt-6 font-display text-[44px] leading-[1.02] font-semibold tracking-[-0.01em] sm:text-[60px] desk:text-[76px]">
                {words("One house for")}
                {words("MENA's venture", 3)}
                {words("ecosystem.", 5, "lp-grad")}
              </h1>
              <p className="lp-fade-in mt-6 max-w-[520px] text-[16px] leading-relaxed text-[var(--lp-fg)] desk:text-[17px]" style={{ "--delay": ".9s" } as React.CSSProperties}>
                Hands-on partners for the people building MENA&apos;s ventures. We bring operating, investing and advisory experience, knowledge and access to every side of the table, so the ecosystem grows together.
              </p>
              <div className="lp-fade-in mt-9 flex flex-wrap items-center gap-3" style={{ "--delay": "1.1s" } as React.CSSProperties}>
                <Primary href={join} big>Join the community</Primary>
                <Secondary href="#journey">Walk through the house</Secondary>
              </div>
              <p className="lp-fade-in mt-5 text-[12.5px] text-[var(--lp-muted)]" style={{ "--delay": "1.3s" } as React.CSSProperties}>
                One account for everything. Sign up with Google, LinkedIn or email.
              </p>
            </div>
            <div className="lp-fade-in relative -mx-5 sm:mx-0 sm:px-6 desk:-mr-16 desk:px-0" style={{ "--delay": ".3s" } as React.CSSProperties}>
              <FloatingScene
                src="/landing/house-blong.webp"
                alt="A 3D cutaway of the VentureWeavers house: a show stage, a classroom, a workshop and an AI lab, with members networking in the middle, joined by glowing teal threads"
                width={2000}
                height={1618}
                priority
                sizes="(min-width: 900px) 760px, 100vw"
                hotspots={HOUSE_SPOTS}
                flows={HOUSE_FLOWS}
              />
            </div>
          </div>
          <div className="lp-scroll-cue absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] font-bold tracking-[.2em] text-[var(--lp-muted)] uppercase desk:flex" aria-hidden="true">
            <span className="block h-8 w-px bg-gradient-to-b from-teal to-transparent" />
            Scroll to walk through
          </div>
        </ScrollProgress>

        {/* ---------------------------------------------------------------- audiences marquee */}
        <section aria-label="Who we work with" className="lp-marquee border-y border-[var(--lp-line)] py-5">
          <div className="lp-marquee-track">
            {[0, 1].map((k) => (
              <ul key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-10 pr-10 font-display text-[22px] font-semibold text-[var(--lp-muted)] desk:text-[28px]">
                {["Founders", "Angel investors", "Institutional investors", "Venture studios", "Corporates", "Hubs and accelerators", "Experts and mentors", "Career professionals", "Ecosystem newcomers"].map((a, i) => (
                  <li key={a} className="flex items-center gap-10 whitespace-nowrap">
                    {a}
                    <span className="h-2 w-2 rounded-full" style={{ background: SPACES[i % SPACES.length].colour }} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- statement, lit by scroll */}
        <section className="mx-auto max-w-[1100px] px-5 py-24 desk:px-8 desk:py-36" aria-label="What we do">
          <LitStatement
            className="font-display text-[30px] leading-[1.18] font-semibold sm:text-[40px] desk:text-[56px]"
            text="Shows on stage, a school for venture, partners who build with you, AI for raising capital and a community to meet in. Five spaces, woven into one house."
            teal={["woven", "house"]}
          />
        </section>

        {/* ---------------------------------------------------------------- the journey (pinned) */}
        <div id="journey" className="scroll-mt-0">
          <Journey src="/landing/journey-blong.webp" width={6336} height={2688} steps={JOURNEY(app, join)} eyebrow="Walk through the house" title="Five spaces, one path through them." />
        </div>

        {/* ---------------------------------------------------------------- each space, in depth */}
        <section id="spaces" className="relative mx-auto max-w-[1240px] scroll-mt-24 px-5 py-24 desk:px-8 desk:py-32">
          <div className="max-w-[720px]">
            <p className="lp-eyebrow" data-reveal>Five spaces, worked in depth</p>
            <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
              Every way in to venture, built from real practice.
            </h2>
          </div>
          <StackDeck className="mt-12 pb-[6vh] desk:mt-16">
            {SPACES.map((sp, i) => (
              <article key={sp.key} id={`space-${sp.key}`} data-stack className="scroll-mt-24" style={{ zIndex: i + 1 }}>
                <div
                  className="lp-stack-card relative grid items-center gap-4 overflow-hidden rounded-[26px] border border-white/10 p-5 shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.8)] desk:grid-cols-2 desk:gap-12 desk:rounded-[32px] desk:p-12"
                  style={{ background: `radial-gradient(ellipse at ${i % 2 ? "85%" : "15%"} 40%, color-mix(in srgb, ${sp.colour} 22%, transparent), transparent 60%), #0a1819` }}
                >
                  <div className={`relative mx-auto w-full max-w-[min(100%,30svh)] desk:max-w-none ${i % 2 ? "desk:order-2" : ""}`}>
                    <div className="pointer-events-none absolute inset-[12%] rounded-full opacity-40 blur-[70px]" style={{ background: sp.colour }} />
                    <FloatingScene
                      src={sp.photo}
                      alt={`${sp.name}: ${sp.line}`}
                      width={sp.size[0]}
                      height={sp.size[1]}
                      sizes="(min-width: 900px) 560px, 80vw"
                      hotspots={sp.labels.map((l) => ({ ...l, colour: sp.colour }))}
                      flows={sp.flows.map((points) => ({ colour: "#29BE9C", points }))}
                    />
                  </div>
                  <div className="relative flex flex-col gap-2.5 desk:gap-3">
                    <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10.5px] font-bold tracking-[.14em] uppercase desk:text-[11px]" style={{ color: sp.tint }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: sp.colour, boxShadow: `0 0 12px ${sp.colour}` }} />
                      0{i + 1} · {sp.kicker}
                    </span>
                    <h3 className="font-display text-[28px] leading-tight font-semibold desk:text-[44px]">{sp.name}</h3>
                    <p className="text-[16px] font-bold text-white desk:text-[18px]">{sp.line}</p>
                    <p className="text-[14px] leading-relaxed text-[var(--lp-fg)] desk:text-[15px]">{sp.body}</p>
                    <ul className="mt-1 hidden flex-wrap gap-1.5 sm:flex desk:gap-2">
                      {sp.points.map((pt) => (
                        <li key={pt} className="rounded-full border border-[var(--lp-line)] bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold text-[var(--lp-fg)] desk:px-3 desk:text-[12.5px]">{pt}</li>
                      ))}
                    </ul>
                    <a href={`${app}${sp.href}`} className="group mt-2 inline-flex items-center gap-2 self-start text-[15px] font-bold" style={{ color: sp.tint }}>
                      {sp.cta}
                      <ArrowUpRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  </div>
                  <div className="lp-stack-shade pointer-events-none absolute inset-0 bg-[#050d0e]" aria-hidden="true" />
                </div>
              </article>
            ))}
          </StackDeck>
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
                    {[["Content", "Outloud", "#E39B2D"], ["Education", "TVS", "#1F4FA3"], ["Services", "BRICKR", "#B5532F"], ["Products", "Eureka", "#7C5CE0"], ["Community", "BLong", "#8DBF2E"], ["Resources", "Library", "#29BE9C"]].map(([type, name, c]) => (
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
                        { c: "#E39B2D", t: "Open Floor · Show 02", s: "Your seat is confirmed", img: "/landing/stage.webp" },
                        { c: "#1F4FA3", t: "TVAC", s: "Application in review", img: "/landing/classroom.webp" },
                        { c: "#B5532F", t: "BRICKR meeting", s: "Thursday, 11:00 Cairo", img: "/landing/workshop.webp" },
                      ].map((x) => (
                        <div key={x.t} className="overflow-hidden rounded-xl border border-[var(--lp-line)] bg-white/[0.03]">
                          <div className="relative h-16 sm:h-20"><Image src={x.img} alt="" fill sizes="220px" className="scale-125 object-cover" /></div>
                          <div className="p-2.5">
                            <span className="mb-1 block h-0.5 w-6 rounded" style={{ background: x.c }} />
                            <b className="block truncate text-[12.5px]">{x.t}</b>
                            <span className="block truncate text-[11px] text-[var(--lp-muted)]">{x.s}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden items-center gap-3 rounded-xl border border-[var(--lp-line)] bg-white/[0.03] p-3 sm:flex">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C5CE0]/20 text-[#7C5CE0]"><Cpu size={15} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><b className="block text-[12.5px]">Eureka · QuidQuo</b><span className="block text-[11px] text-[var(--lp-muted)]">You&apos;re on the waitlist. We&apos;ll let you in early.</span></span>
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

        {/* ---------------------------------------------------------------- who it's for: a row that travels sideways */}
        <div id="who" className="scroll-mt-0">
          <HScroll
            label="Who it's for"
            head={
              <div className="flex flex-col gap-4 desk:flex-row desk:items-end desk:justify-between">
                <div className="max-w-[640px]">
                  <p className="lp-eyebrow">Who it&apos;s for</p>
                  <h2 className="mt-4 font-display text-[32px] leading-[1.05] font-semibold desk:text-[52px]">One ecosystem. A place for every stakeholder.</h2>
                </div>
                <p className="max-w-[380px] text-[14.5px] leading-relaxed text-[var(--lp-fg)] desk:text-[15px]">
                  Raising a round, allocating capital, running an accelerator or taking your first step into venture: there is a clear way in for you.
                </p>
              </div>
            }
          >
            {AUDIENCES.map((a, i) => (
              <article key={a.name} className="lp-glass group flex w-[min(78vw,330px)] shrink-0 flex-col gap-3 rounded-[22px] p-6 transition-colors hover:bg-white/[0.06] desk:w-[340px]">
                <span className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--lp-line)] bg-white/[0.04] text-teal transition-transform group-hover:scale-110"><a.icon size={20} aria-hidden="true" /></span>
                  <span className="font-display text-[30px] font-semibold text-white/10">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <h3 className="font-display text-[19px] font-semibold">{a.name}</h3>
                <p className="flex-1 text-[14px] leading-relaxed text-[var(--lp-fg)]">{a.body}</p>
              </article>
            ))}
          </HScroll>
        </div>

        {/* ---------------------------------------------------------------- Upcoming flagships: Open Floor (Outloud) and TVAC (TVS) */}
        <section id="flagships" aria-labelledby="flagships-h" className="relative scroll-mt-24 overflow-hidden border-y border-[var(--lp-line)] py-24 desk:py-32">
          <div className="mx-auto max-w-[1240px] px-5 desk:px-8">
            <div className="max-w-[720px]">
              <p className="lp-eyebrow" data-reveal>Upcoming flagships</p>
              <h2 id="flagships-h" className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                Two flagships. <span className="lp-grad">Coming soon.</span>
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                A live show where the room shares and discusses real venture stories, and an experiential program on the venture asset class beyond the mechanics. Get notified when they open, or book a private one for your team.
              </p>
            </div>
          </div>
          <article id="open-floor" className="relative mt-8 scroll-mt-24 bg-[radial-gradient(ellipse_at_30%_60%,rgb(227_155_45/0.12),transparent_60%)] py-10 desk:mt-20">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 desk:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] desk:gap-14 desk:px-8">
            <div className="order-2 desk:order-1" data-reveal>
              <OpenFloorStage />
            </div>
            <div className="order-1 desk:order-2">
              <div className="flex flex-wrap items-center gap-2" data-reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#E39B2D]/40 bg-[#E39B2D]/10 px-3 py-1.5 font-mono text-[11px] font-bold tracking-[.14em] text-[#F2B65A] uppercase">An Outloud format · Flagship</span>
                <span className="lp-soon inline-flex items-center gap-1.5 rounded-full bg-[#E39B2D] px-3 py-1.5 text-[11.5px] font-extrabold text-ink"><span className="h-1.5 w-1.5 rounded-full bg-ink" />Coming soon</span>
              </div>
              <h2 className="mt-5 flex items-center gap-3 font-display text-[44px] leading-[1] font-semibold desk:text-[68px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                <MessageCircleQuestion className="h-10 w-10 shrink-0 text-[#F2B65A] desk:h-14 desk:w-14" aria-hidden="true" />
                <span>Open <span className="text-[#F2B65A]">Floor.</span></span>
              </h2>
              <p className="mt-4 font-display text-[22px] leading-tight font-semibold text-white desk:text-[28px]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                Real stories. <span className="text-[#F2B65A]">Open discussion.</span>
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 3 } as React.CSSProperties}>
                An interactive business session where we share and discuss real venture stories from every side of the table, and the room brings its own experiences and questions. One topic, two hours, hosted by Ahmed Fouad and Karim Hemdan, with expert guests for specific topics.
              </p>
              <dl className="mt-6 grid grid-cols-3 gap-2" data-reveal style={{ "--d": 3 } as React.CSSProperties}>
                {[["1", "topic per session"], ["2 h", "in two rounds"], ["Live", "stories & questions from the room"]].map(([n, l]) => (
                  <div key={l} className="lp-glass rounded-2xl px-3 py-3">
                    <dt className="font-display text-[24px] leading-none font-semibold text-[#F2B65A] desk:text-[28px]">{n}</dt>
                    <dd className="mt-1 text-[11.5px] leading-snug text-[var(--lp-fg)]">{l}</dd>
                  </div>
                ))}
              </dl>
              <ol className="mt-3 grid grid-cols-2 gap-2">
                {([
                  [QrCode, "Scan to join", "A QR code on screen. No app."],
                  [MessageSquare, "Share", "Share stories & questions, named or anonymous."],
                  [Shuffle, "The Pick", "Stories & questions drawn at random, on screen."],
                  [MessagesSquare, "Discussion", "Stories & questions discussed together, to a clear take or next step."],
                ] as [LucideIcon, string, string][]).map(([Icon, t, b], i) => (
                  <li key={t} className="lp-glass flex gap-2.5 rounded-2xl p-3" data-reveal style={{ "--d": i + 4 } as React.CSSProperties}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E39B2D]/15 text-[#F2B65A]"><Icon size={16} aria-hidden="true" /></span>
                    <span><b className="block text-[13.5px]">{t}</b><span className="text-[12px] leading-snug text-[var(--lp-fg)]">{b}</span></span>
                  </li>
                ))}
              </ol>
              <div className="mt-7 flex flex-wrap items-center gap-3" data-reveal>
                <Magnetic href={join} className="group inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,#f2b65a,#E39B2D)] px-6 text-[15px] font-bold text-ink shadow-[0_10px_40px_-8px_rgb(227_155_45/0.6)] hover:brightness-110">
                  <BellRing size={16} aria-hidden="true" /> Get notified
                </Magnetic>
                <a href={`${app}/outloud`} className="group inline-flex h-12 items-center gap-2 rounded-full border border-[#E39B2D]/50 px-6 text-[15px] font-bold text-[#F2B65A] transition-colors hover:bg-[#E39B2D]/10">
                  Book a private session <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                </a>
              </div>
              <p className="mt-3 text-[13px] text-[var(--lp-muted)]" data-reveal>Public shows for the community. Private sessions for your team, portfolio or community.</p>
            </div>
          </div>
          </article>
          <article id="tvac" className="relative mt-8 scroll-mt-24 bg-[radial-gradient(ellipse_at_70%_50%,rgb(31_79_163/0.18),transparent_60%)] py-10 desk:mt-16">
            <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 desk:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] desk:gap-14 desk:px-8">
              <div className="order-1">
                <div className="flex flex-wrap items-center gap-2" data-reveal>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#5d86d6]/45 bg-[#1F4FA3]/15 px-3 py-1.5 font-mono text-[11px] font-bold tracking-[.14em] text-[#8AAEF0] uppercase">A TVS program · Flagship</span>
                  <span className="lp-soon lp-soon-blue inline-flex items-center gap-1.5 rounded-full bg-[#1F4FA3] px-3 py-1.5 text-[11.5px] font-extrabold text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" />Coming soon</span>
                </div>
                <h2 className="mt-5 flex items-center gap-3 font-display text-[44px] leading-[1] font-semibold desk:text-[68px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                  <GraduationCap className="h-10 w-10 shrink-0 text-[#8AAEF0] desk:h-14 desk:w-14" aria-hidden="true" />
                  <span>TVAC<span className="text-[#8AAEF0]">.</span></span>
                </h2>
                <p className="mt-4 font-display text-[22px] leading-tight font-semibold text-white desk:text-[28px]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                  The Venture Asset Class. <span className="text-[#8AAEF0]">Beyond Technicalities.</span>
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 3 } as React.CSSProperties}>
                  An experiential program on the logic, mindset and integrated thinking behind venture capital, for every stakeholder. It goes beyond the mechanics, so you can read a fast-changing venture world, see how its parts connect and find your place in it.
                </p>
                <dl className="mt-6 grid grid-cols-3 gap-2" data-reveal style={{ "--d": 3 } as React.CSSProperties}>
                  {[["Every", "stakeholder at the same table"], ["Deep", "logic and mindset, not mechanics"], ["Live", "learning by experience"]].map(([n, l]) => (
                    <div key={l} className="lp-glass rounded-2xl px-3 py-3">
                      <dt className="font-display text-[24px] leading-none font-semibold text-[#8AAEF0] desk:text-[28px]">{n}</dt>
                      <dd className="mt-1 text-[11.5px] leading-snug text-[var(--lp-fg)]">{l}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {([
                    [Mic, "Masterclass", "A focused session on the big picture of how ventures are built and backed."],
                    [Users, "Program", "The full experience: an in-depth journey into how venture really thinks and works."],
                  ] as [LucideIcon, string, string][]).map(([Icon, t, b], i) => (
                    <li key={t} className="lp-glass flex gap-2.5 rounded-2xl p-3" data-reveal style={{ "--d": i + 4 } as React.CSSProperties}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1F4FA3]/25 text-[#8AAEF0]"><Icon size={16} aria-hidden="true" /></span>
                      <span><b className="block text-[13.5px]">{t}</b><span className="text-[12px] leading-snug text-[var(--lp-fg)]">{b}</span></span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex flex-wrap items-center gap-3" data-reveal>
                  <Magnetic href={join} className="group inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,#3d72d9,#1F4FA3)] px-6 text-[15px] font-bold text-white shadow-[0_10px_40px_-8px_rgb(31_79_163/0.7)] hover:brightness-110">
                    <BellRing size={16} aria-hidden="true" /> Get notified
                  </Magnetic>
                  <a href={`${app}/tvs`} className="group inline-flex h-12 items-center gap-2 rounded-full border border-[#5d86d6]/55 px-6 text-[15px] font-bold text-[#8AAEF0] transition-colors hover:bg-[#1F4FA3]/15">
                    Book a private session <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
                <p className="mt-3 text-[13px] text-[var(--lp-muted)]" data-reveal>Open cohorts for the community. Private programs for your team, portfolio or community.</p>
              </div>
              <div className="order-2" data-reveal>
                <TvacRoom />
              </div>
            </div>
          </article>
        </section>

        {/* ---------------------------------------------------------------- founders */}
        <section id="team" className="scroll-mt-24 border-t border-[var(--lp-line)] bg-[#0a1617] py-24 desk:py-32">
          <div className="mx-auto max-w-[1240px] px-5 desk:px-8">
            <div className="max-w-[680px]">
              <p className="lp-eyebrow" data-reveal>Who we are</p>
              <h2 className="mt-4 font-display text-[36px] leading-[1.05] font-semibold desk:text-[52px]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
                Two ecosystem builders. Built in Cairo, working across MENA.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
                Combined, we bring 30+ years of experience across different industries, stages and markets, and every space is run hands-on by the two of us.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2" data-reveal style={{ "--d": 3 } as React.CSSProperties} aria-label="Fields of experience">
                {["Venture building", "Venture operations", "Investment & fund management", "Consulting", "Ecosystem building"].map((f) => (
                  <li key={f} className="rounded-full border border-teal/30 bg-teal/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--lp-fg)]">{f}</li>
                ))}
              </ul>
            </div>
            <div className="mt-12 grid gap-5 desk:grid-cols-2">
              {FOUNDERS.map((f, i) => (
                <div key={f.name} data-reveal style={{ "--d": i } as React.CSSProperties}>
                  <Tilt className="h-full rounded-[26px]" max={5}>
                    <article className="lp-glass flex h-full flex-col overflow-hidden rounded-[26px] sm:flex-row">
                      <div className="relative aspect-[4/5] sm:aspect-auto sm:w-[46%]">
                        <Image src={f.photo} alt={f.name} fill quality={90} sizes="(min-width: 900px) 300px, (min-width: 640px) 46vw, 100vw" className="object-cover object-top" />
                      </div>
                      <div className="lp-pop flex flex-1 flex-col gap-2 p-6">
                        <span className="text-[11px] font-extrabold tracking-[.16em] text-teal uppercase">{f.role}</span>
                        <h3 className="font-display text-[24px] font-semibold">{f.name}</h3>
                        <p className="text-[14px] leading-relaxed text-[var(--lp-fg)]">{f.short}</p>
                        <div className="mt-auto flex flex-wrap items-center gap-4 pt-3">
                          <FounderReadMore founder={f} />
                          <a href={f.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-teal hover:underline">
                            <Linkedin size={15} aria-hidden="true" /> LinkedIn
                          </a>
                        </div>
                      </div>
                    </article>
                  </Tilt>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- closing: the woven logo */}
        <section className="relative overflow-hidden py-24 desk:py-36">
          <div className="lp-orb top-[20%] left-[30%] h-[40vw] w-[40vw] bg-[#02686f] opacity-40" />
          <div className="relative mx-auto flex max-w-[900px] flex-col items-center px-5 text-center">
            <LogoWeave />
            <h2 className="mt-14 font-display text-[40px] leading-[1.02] font-semibold desk:text-[64px]" data-reveal>
              Step inside <span className="lp-grad">the house.</span>
            </h2>
            <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-[var(--lp-fg)]" data-reveal style={{ "--d": 1 } as React.CSSProperties}>
              Join founders, investors and builders across MENA. One account opens Outloud shows, TVS programs, meetings with the partners, the Eureka product waitlists, the BLong community, VW Notes and the library.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3" data-reveal style={{ "--d": 2 } as React.CSSProperties}>
              <Primary href={join} big>Join the community</Primary>
              <Secondary href={`${app}/brickr`}>Request a meeting</Secondary>
            </div>
            <p className="mt-6 text-[13px] text-[var(--lp-muted)]" data-reveal style={{ "--d": 3 } as React.CSSProperties}>
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
            <p className="max-w-[300px] text-[13.5px] leading-relaxed">Experience, knowledge and access to MENA&apos;s venture ecosystem. Five spaces, one member platform.</p>
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
