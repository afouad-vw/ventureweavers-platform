import { CheckCircle2, Clock, Download, Linkedin } from "lucide-react";
import { Markdown } from "@/components/content/markdown";
import { Card, CardHeader } from "@/components/ui/card";
import { formatHours, totalHours, type Person, type Session } from "@/lib/details";
import { initialsOf } from "@/lib/initials";

/** One titled card on a details page. Renders nothing when empty. */
export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} action={aside} />
      {children}
    </Card>
  );
}

export function DetailsText({ source }: { source: string }) {
  return <Markdown source={source} className="flex max-w-[72ch] flex-col gap-3 text-[14px] leading-[1.65] text-muted" />;
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((x) => (
        <li key={x} className="flex items-start gap-2 text-[13.5px]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((x, i) => (
        <li key={x} className="flex items-start gap-2.5 text-[13.5px]">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#0b8088,#02686f)] font-display text-[12px] font-bold text-white shadow-depth-sm">{i + 1}</span>
          <span className="pt-0.5">{x}</span>
        </li>
      ))}
    </ol>
  );
}

export function Outline({ sessions }: { sessions: Session[] }) {
  return (
    <ol className="flex flex-col">
      {sessions.map((s, i) => (
        <li key={`${s.title}-${i}`} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
          <span className="w-7 shrink-0 font-display text-[15px] font-semibold text-faint">{String(i + 1).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{s.title}</span>
          <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-faint"><Clock size={13} aria-hidden="true" />{formatHours(s.hours)}</span>
        </li>
      ))}
    </ol>
  );
}

export const outlineSummary = (sessions: Session[]) => `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} · ${formatHours(totalHours(sessions))}`;

export function People({ people }: { people: Person[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {people.map((p) => (
        <li key={`${p.name}-${p.title}`} className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(160deg,#0d2526,#02686f)] font-display text-[13px] font-bold text-white shadow-depth-sm">{initialsOf(p.name)}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px]">{p.name}</b>
            {p.title ? <span className="block truncate text-[12.5px] text-faint">{p.title}</span> : null}
          </span>
          {p.linkedin ? (
            <a href={p.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on LinkedIn`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line2/70 bg-card/70 text-[#0a66c2] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-depth-sm">
              <Linkedin size={16} aria-hidden="true" />
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function BrochureLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 self-start rounded-lg border border-line2/70 bg-card/70 px-3.5 text-[13.5px] font-bold backdrop-blur-md transition-[transform,box-shadow,background-color] hover:-translate-y-px hover:bg-card hover:shadow-depth desk:h-9">
      <Download size={15} aria-hidden="true" />
      Download brochure (PDF)
    </a>
  );
}

/** Key facts row under the title: icon + text pairs. */
export function Facts({ items }: { items: { icon: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <ul className="grid gap-2 text-[13.5px] sm:grid-cols-2">
      {items.map((f, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="text-faint">{f.icon}</span>
          {f.text}
        </li>
      ))}
    </ul>
  );
}
