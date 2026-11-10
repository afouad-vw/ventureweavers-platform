import { cn } from "@/lib/cn";

type Tone = "default" | "soft" | "ink";

const tones: Record<Tone, string> = {
  default: "glass text-fg",
  soft: "bg-soft/85 border-white/40 text-fg shadow-depth-sm backdrop-blur-md",
  ink: "border-ink-line text-ink-fg bg-[linear-gradient(160deg,#0d2526,#071112_65%)] shadow-depth-lg",
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
    <Tag className={cn("flex min-w-0 flex-col gap-2 rounded-[20px] border p-4", tones[tone], className)}>
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
