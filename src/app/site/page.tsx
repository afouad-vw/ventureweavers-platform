import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { ArrowRight, Briefcase, Cpu, GraduationCap, Mic, type LucideIcon } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { ThreadTag, type TagTone } from "@/components/ui/tag";
import { hostConfig, SURFACE_HEADER } from "@/lib/hosts";

export const metadata: Metadata = {
  title: { absolute: "VentureWeavers · Experience, knowledge and access to MENA's venture ecosystem" },
  description: "VentureWeavers brings experience, knowledge and access to MENA's venture ecosystem through Outloud, The Venture School, BRICKR and QuidQuo. Based in Cairo.",
};

const spaces: { thread: TagTone; name: string; line: string; body: string; href: string; cta: string; icon: LucideIcon; photo: string }[] = [
  {
    thread: "Outloud",
    name: "Outloud",
    line: "Content, shows and events.",
    body: "Open Floor is our first format: founders bring real questions, the room picks one, and we work through it together on stage.",
    href: "/outloud",
    cta: "See upcoming shows",
    icon: Mic,
    photo: "/images/stage.jpg",
  },
  {
    thread: "TVS",
    name: "The Venture School",
    line: "Learn it in practice. Lead it in motion.",
    body: "Programs and masterclasses built from real ventures. TVAC is the foundation for every 360 program.",
    href: "/tvs",
    cta: "Explore programs",
    icon: GraduationCap,
    photo: "/images/room.jpg",
  },
  {
    thread: "BRICKR",
    name: "BRICKR",
    line: "Fractional leadership.",
    body: "Hands-on work with partners on building and growing ventures and portfolios, from a first diagnostic to a monthly engagement.",
    href: "/brickr",
    cta: "Request a meeting",
    icon: Briefcase,
    photo: "/images/round.jpg",
  },
  {
    thread: "QuidQuo",
    name: "QuidQuo",
    line: "AI for capital formation.",
    body: "In development. Follow the build and join the waitlist to be first in when it opens.",
    href: "/quidquo",
    cta: "Join the waitlist",
    icon: Cpu,
    photo: "/images/hands.jpg",
  },
];

const founders = [
  { name: "Ahmed Fouad", role: "Co-founder", photo: "/images/ahmed.jpg", bio: "[BIO]" },
  { name: "Karim Hemdan", role: "Co-founder", photo: "/images/karim.jpg", bio: "[BIO]" },
];

/** The public landing page, served at ventureweavers.com. */
export default async function SitePage() {
  const onSite = (await headers()).get(SURFACE_HEADER) === "site";
  const app = onSite ? `https://${hostConfig().app}` : "";

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-ink-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-4 px-4 desk:px-6">
          <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={180} height={13} priority />
          <nav aria-label="Sections" className="ml-6 hidden gap-5 text-[13.5px] font-semibold text-ink-fg desk:flex">
            <a href="#spaces" className="hover:text-white">Spaces</a>
            <a href="#who" className="hover:text-white">Who we are</a>
          </nav>
          <span className="flex-1" />
          <a href={`${app}/sign-in`} className="text-[13.5px] font-bold text-ink-fg hover:text-white">Sign in</a>
          <a href={`${app}/join`} className={buttonClass("teal", "md")}>Join</a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-ink text-white">
        <Image src="/images/crowd.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/20" />
        <div className="relative mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-20 desk:px-6 desk:py-28">
          <ThreadTag thread="House" label="Cairo · across MENA" />
          <h1 className="max-w-[720px] font-display text-[34px] leading-[1.1] font-semibold desk:text-[52px]">
            Experience, knowledge and access to MENA&apos;s venture ecosystem.
          </h1>
          <p className="max-w-[560px] text-[15px] text-ink-fg desk:text-base">
            VentureWeavers is Ahmed Fouad and Karim Hemdan. We work with founders, operators and investors through four spaces: shows and events, a venture school, fractional leadership, and AI for raising capital.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a href={`${app}/join`} className={buttonClass("teal", "lg")}>
              Join VentureWeavers <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a href="#spaces" className={buttonClass("secondary", "lg", "border-ink-line bg-transparent text-white hover:bg-ink2")}>
              See the spaces
            </a>
          </div>
        </div>
      </section>

      <section id="spaces" className="mx-auto flex max-w-[1180px] scroll-mt-20 flex-col gap-6 px-4 py-14 desk:px-6 desk:py-20">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-extrabold tracking-[1.4px] text-link uppercase">Four spaces</span>
          <h2 className="font-display text-[26px] font-semibold desk:text-[32px]">One house, four ways in</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {spaces.map((s) => (
            <article key={s.name} className="glass vw-surface vw-lift group flex flex-col border">
              <div className="relative h-[170px]">
                <Image src={s.photo} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                <span className="absolute top-3 left-3"><ThreadTag thread={s.thread} /></span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <s.icon size={20} aria-hidden="true" className="text-muted" />
                  {s.name}
                </h3>
                <p className="text-[14px] font-bold">{s.line}</p>
                <p className="text-[13.5px] text-muted">{s.body}</p>
                <a href={`${app}${s.href}`} className={buttonClass("secondary", "md", "mt-auto self-start")}>
                  {s.cta} <ArrowRight size={15} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="who" className="scroll-mt-20 border-y border-line bg-card">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-14 desk:grid-cols-[1fr_1.4fr] desk:px-6 desk:py-20">
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-extrabold tracking-[1.4px] text-link uppercase">Who we are</span>
            <h2 className="font-display text-[26px] font-semibold desk:text-[32px]">Two operators, one house</h2>
            <p className="text-[14px] text-muted">
              We bring our experience, knowledge and access to MENA&apos;s venture ecosystem to the people building it. Every space is run hands-on by the two of us.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {founders.map((f) => (
              <div key={f.name} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-bg">
                <div className="relative aspect-[4/3]">
                  <Image src={f.photo} alt={f.name} fill sizes="(min-width: 900px) 30vw, 100vw" className="object-cover object-top" />
                </div>
                <div className="flex flex-col gap-1 p-4">
                  <b className="font-display text-lg">{f.name}</b>
                  <span className="text-[13px] font-bold text-link">{f.role}</span>
                  <p className="text-[13.5px] text-muted">{f.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1180px] flex-col items-start gap-4 px-4 py-14 desk:flex-row desk:items-center desk:justify-between desk:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[24px] font-semibold">Join the house</h2>
          <p className="text-[14px] text-muted">One account for shows, programs, requests and the QuidQuo waitlist.</p>
        </div>
        <a href={`${app}/join`} className={buttonClass("primary", "lg")}>
          Create your account <ArrowRight size={16} aria-hidden="true" />
        </a>
      </section>

      <footer className="bg-ink text-ink-fg">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-8 text-[13px] desk:flex-row desk:items-center desk:justify-between desk:px-6">
          <Image src="/brand/logo-on-dark.svg" alt="VentureWeavers" width={150} height={11} />
          <span>Based in Cairo · working across MENA</span>
          <span className="text-ink-muted">© {new Date().getFullYear()} VentureWeavers</span>
        </div>
      </footer>
    </div>
  );
}
