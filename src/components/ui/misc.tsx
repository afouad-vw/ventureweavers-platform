import QRCode from "qrcode";
import { cn } from "@/lib/cn";

/** Page title row: optional tag above, title, one line of context, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  above,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  above?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {above}
        <h1 className="font-display text-xl font-semibold desk:text-[22px]">{title}</h1>
        {description ? <p className="max-w-[640px] text-[13.5px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-dashed border-line2 p-6 text-center text-[13.5px] text-faint", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase", className)}>{children}</span>;
}

/** Ticket QR code, rendered on the server as an SVG. */
export async function TicketQR({ value, size = 140 }: { value: string; size?: number }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, color: { dark: "#071112", light: "#FFFFFF" } });
  return (
    <span
      role="img"
      aria-label={`QR code for ticket ${value}`}
      className="inline-flex rounded-xl bg-white p-2.5 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Date tile used in event lists. */
export function DateBox({ date, tone }: { date: string; tone?: "tvs" }) {
  const d = new Date(date + "T12:00:00");
  const ok = !Number.isNaN(d.getTime());
  const mon = ok ? d.toLocaleString("en-GB", { month: "short" }).toUpperCase() : "—";
  const day = ok ? d.getDate() : "—";
  return (
    <span
      className={cn(
        "flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[9px] border leading-tight",
        tone === "tvs" ? "border-transparent bg-tvs-bg text-tvs-fg" : "border-line bg-bg text-fg",
      )}
    >
      <small className={cn("text-[10px] font-extrabold tracking-wide", tone === "tvs" ? "" : "text-link")}>{mon}</small>
      <b className="font-display text-lg">{day}</b>
    </span>
  );
}
