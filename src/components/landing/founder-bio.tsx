"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Linkedin, X } from "lucide-react";

export type Founder = { name: string; role: string; photo: string; short: string; long: string[]; linkedin: string };

/** "Read more" on a founder card: a dialog with the full brief and LinkedIn. */
export function FounderReadMore({ founder }: { founder: Founder }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    // Keep the page behind still while the brief is open.
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-teal/40 px-4 text-[13.5px] font-bold text-teal transition-colors hover:bg-teal/10">
        Read more <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        aria-labelledby={`fb-${founder.linkedin}`}
        className="lp-dialog m-auto w-[min(820px,calc(100vw-32px))] max-w-none overflow-hidden rounded-[26px] border border-white/10 bg-[#0b1819] p-0 text-white shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)] backdrop:bg-[#030809]/75 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[calc(100svh-48px)] flex-col sm:flex-row" data-lenis-prevent>
          <div className="relative hidden shrink-0 sm:block sm:w-[38%]">
            <Image src={founder.photo} alt="" fill quality={90} sizes="320px" className="object-cover object-top" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_60%,#0b1819)]" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start gap-3 border-b border-white/10 p-5 sm:p-6">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full sm:hidden">
                <Image src={founder.photo} alt="" fill quality={85} sizes="56px" className="object-cover object-top" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-extrabold tracking-[.16em] text-teal uppercase">{founder.role}</span>
                <h3 id={`fb-${founder.linkedin}`} className="font-display text-[26px] leading-tight font-semibold">{founder.name}</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 text-[14.5px] leading-relaxed text-[var(--lp-fg)] sm:p-6">
              {founder.long.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="border-t border-white/10 p-5 sm:px-6 sm:py-4">
              <a href={founder.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-teal px-4 text-[13.5px] font-bold text-ink hover:brightness-110">
                <Linkedin size={15} aria-hidden="true" /> View on LinkedIn
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
