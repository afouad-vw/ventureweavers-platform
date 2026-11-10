"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Modal and side drawer built on the native <dialog> element, so focus trapping,
 * Escape to close and the backdrop come from the browser.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handle = () => onClose();
    d.addEventListener("close", handle);
    return () => d.removeEventListener("close", handle);
  }, [onClose]);
  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose();
  };
  return { ref, onBackdrop };
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line2/70 bg-card/70 text-fg transition-colors hover:bg-card">
      <X size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { ref, onBackdrop } = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      aria-label={title}
      className="glass-strong m-auto max-h-[calc(100dvh-32px)] w-[min(440px,calc(100vw-32px))] overflow-auto rounded-2xl border p-0 text-fg backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0 flex-1">
          {eyebrow ? <span className="text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase">{eyebrow}</span> : null}
          <h2 className="text-[15px] font-extrabold">{title}</h2>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
      {footer ? <div className="flex items-center gap-3 border-t border-line px-4 py-3">{footer}</div> : null}
    </dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Room for side-by-side editing, such as the blog editor with its preview. */
  wide?: boolean;
}) {
  const { ref, onBackdrop } = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      aria-label={title}
      className={cn(
        "glass-strong m-0 ml-auto h-dvh max-h-dvh max-w-full border-l p-0 text-fg backdrop:bg-ink/35 backdrop:backdrop-blur-sm",
        wide ? "w-[min(1040px,100vw)]" : "w-[min(460px,100vw)]",
        "flex-col open:flex",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4.5 pt-[calc(14px+env(safe-area-inset-top))] pb-3.5">
        <div>
          {eyebrow ? <span className="text-[11px] font-extrabold tracking-[1.2px] text-faint uppercase">{eyebrow}</span> : null}
          <h2 className="text-base font-extrabold">{title}</h2>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4.5">{children}</div>
      {footer ? <div className="flex flex-wrap items-center gap-2 border-t border-line px-4.5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">{footer}</div> : null}
    </dialog>
  );
}
