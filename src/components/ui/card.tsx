import { cn } from "@/lib/cn";

type Tone = "default" | "soft" | "ink";

const tones: Record<Tone, string> = {
  default: "bg-card border-line text-fg",
  soft: "bg-soft border-transparent text-fg",
  ink: "bg-ink border-ink-line text-ink-fg",
};

export function Card({
  tone = "default",
  className,
  children,
  as: Tag = "div",
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag className={cn("flex min-w-0 flex-col gap-2 rounded-xl border p-4 shadow-[0_1px_2px_rgb(7_17_18/0.05)]", tones[tone], className)}>
      {children}
    </Tag>
  );
}

/** Title row of a card, with an optional action on the right. */
export function CardHeader({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-extrabold">{title}</h2>
      {action ? <div className="text-[12.5px] font-bold">{action}</div> : null}
    </div>
  );
}
