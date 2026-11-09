import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { ThreadTag, type TagTone } from "@/components/ui/tag";

/**
 * Temporary page body for routes whose features arrive in later phases.
 * Lists what the page will hold, taken from the prototype.
 */
export function Placeholder({
  title,
  description,
  thread,
  phase,
  items,
}: {
  title: string;
  description: string;
  thread?: TagTone;
  phase: string;
  items: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} above={thread ? <ThreadTag thread={thread} /> : undefined} />
      <Card>
        <span className="text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase">Coming in {phase}</span>
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i} className="flex items-start gap-2 text-[13.5px]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
              {i}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
