import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/initials";

const TONES = ["#02686F", "#1F4FA3", "#B5532F", "#6B4FD1", "#7C5CE0", "#3E7F1F", "#8A6D12", "#A23B6B"];

function toneFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** A member's photo, or their initials on a steady colour picked from their id. */
export function MemberAvatar({ id, name, src, size = 44, className }: { id: string; name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34), background: src ? undefined : toneFor(id) }}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- member photo, cropped to a circle
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
