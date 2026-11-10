/**
 * The VentureWeavers weave: fine threads that cross and slowly drift. A brand pattern, not an illustration.
 * Motion stops for reduced motion (see .weave in globals.css).
 */
const THREADS = [
  "M-20 120 C 180 20, 320 220, 520 110 S 860 30, 1220 140",
  "M-20 70 C 200 170, 380 -10, 600 90 S 940 200, 1220 60",
  "M-20 170 C 160 90, 400 260, 640 150 S 980 40, 1220 180",
  "M-20 40 C 240 110, 420 40, 700 120 S 1000 160, 1220 30",
  "M-20 210 C 260 150, 460 230, 760 180 S 1060 110, 1220 220",
];

export function Weave({ id = "weave", className = "", color = "#29BE9C", opacity = 0.55 }: { id?: string; className?: string; color?: string; opacity?: number }) {
  const g = `${id}-g`;
  return (
    <svg className={`weave pointer-events-none ${className}`} viewBox="0 0 1200 240" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset=".25" stopColor={color} stopOpacity={opacity} />
          <stop offset=".75" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {THREADS.map((d, i) => <path key={`b${i}`} d={d} stroke={`url(#${g})`} strokeWidth={1} opacity={0.35} />)}
      {THREADS.map((d, i) => <path key={i} className="t" d={d} stroke={`url(#${g})`} strokeWidth={i % 2 ? 1.6 : 2.2} />)}
    </svg>
  );
}

/** A stitched divider that draws itself once. */
export function Stitch({ className = "", color = "#29BE9C" }: { className?: string; color?: string }) {
  return (
    <svg className={`weave h-6 w-full ${className}`} viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="s" d="M0 12 C 150 0, 300 24, 450 12 S 750 0, 900 12 S 1100 24, 1200 12" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <path className="s" d="M0 12 C 150 24, 300 0, 450 12 S 750 24, 900 12 S 1100 0, 1200 12" stroke={color} strokeWidth={1.5} opacity={0.35} style={{ animationDelay: ".3s" }} />
    </svg>
  );
}

/** Dark page hero with the weave: tag, title, one line and actions. Used at the top of each space. */
export function WeaveHero({
  id,
  above,
  title,
  description,
  actions,
  children,
}: {
  id?: string;
  above?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(135deg,#0d2a2b,#071112_62%)] px-5 py-6 text-white shadow-depth-lg desk:px-7 desk:py-7">
      <Weave id={id} className="absolute inset-0 h-full w-full" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          {above}
          <h1 className="font-display text-[26px] leading-tight font-semibold desk:text-[32px]">{title}</h1>
          {description ? <p className="max-w-[60ch] text-[14px] text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        {children}
      </div>
    </section>
  );
}
