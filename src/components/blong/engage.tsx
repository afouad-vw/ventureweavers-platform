"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, Eye, Heart, Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { compact } from "@/lib/blong/communities";
import { recordShare, recordViews, toggleBookmark, toggleLike } from "@/app/(member)/blong/posts-actions";

type Kind = "post" | "comment" | "room_message";

/** Heart with a count; flips at once and settles on the server's answer. */
export function LikeButton({ kind, id, liked: l0, likes: n0, small }: { kind: Kind; id: string; liked: boolean; likes: number; small?: boolean }) {
  const [s, setS] = useState({ liked: l0, likes: n0 });
  const [pending, start] = useTransition();
  const toast = useToast();
  useEffect(() => setS({ liked: l0, likes: n0 }), [l0, n0]);
  return (
    <button
      type="button"
      className={cn("bl-act", s.liked && "on like")}
      aria-pressed={s.liked}
      aria-label={s.liked ? `Unlike (${s.likes})` : `Like (${s.likes})`}
      disabled={pending}
      onClick={() => {
        const prev = s;
        setS({ liked: !s.liked, likes: s.likes + (s.liked ? -1 : 1) });
        start(async () => {
          const r = await toggleLike(kind, id);
          if (!r.ok) { setS(prev); return toast(r.error); }
          if (r.value) setS(r.value);
        });
      }}
    >
      <Heart size={small ? 13 : 15} fill={s.liked ? "currentColor" : "none"} aria-hidden="true" />
      {s.likes ? <span>{compact(s.likes)}</span> : null}
    </button>
  );
}

export function CommentCount({ count, onClick, label = "Comments" }: { count: number; onClick?: () => void; label?: string }) {
  return (
    <button type="button" className="bl-act" onClick={onClick} aria-label={`${label} (${count})`}>
      <MessageCircle size={15} aria-hidden="true" />{count ? <span>{compact(count)}</span> : null}
    </button>
  );
}

export function ViewCount({ views }: { views: number }) {
  return (
    <span className="bl-act static" title="People who saw this" aria-label={`${views} views`}>
      <Eye size={15} aria-hidden="true" /><span>{compact(views)}</span>
    </span>
  );
}

/** Save to My space › Saved. */
export function BookmarkButton({ kind, id, saved: s0 }: { kind: "post" | "room_message"; id: string; saved: boolean }) {
  const [saved, setSaved] = useState(s0);
  const [pending, start] = useTransition();
  const toast = useToast();
  useEffect(() => setSaved(s0), [s0]);
  return (
    <button
      type="button"
      className={cn("bl-act", saved && "on")}
      aria-pressed={saved}
      aria-label={saved ? "Remove from Saved" : "Save"}
      disabled={pending}
      onClick={() => {
        setSaved(!saved);
        start(async () => {
          const r = await toggleBookmark(kind, id);
          if (!r.ok) { setSaved(saved); return toast(r.error); }
          toast(r.value ? "Saved to My space" : "Removed from Saved");
        });
      }}
    >
      <Bookmark size={15} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

/** Share: copy the link, the phone's share sheet, or send it to a member in Messages. Shares are counted once a day per way. */
export function ShareButton({ kind, id, path, title, shares }: { kind: "post" | "room_message"; id: string; path: string; title: string; shares?: number }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const url = () => `${window.location.origin}${path}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url()); toast("Link copied. Only people who can see it will be able to open it."); } catch { toast("Couldn't copy the link."); }
    void recordShare(kind, id, "link");
    setOpen(false);
  };
  const device = async () => {
    try { await navigator.share({ title, url: url() }); void recordShare(kind, id, "device"); } catch { /* closed */ }
    setOpen(false);
  };
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <>
      <button type="button" className="bl-act" aria-label={`Share${shares ? ` (${shares})` : ""}`} onClick={() => setOpen(true)}>
        <Share2 size={15} aria-hidden="true" />{shares ? <span>{compact(shares)}</span> : null}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Share">
        <div className="flex flex-col gap-2">
          <button type="button" className="bl-share" onClick={copy}><Link2 size={16} aria-hidden="true" />Copy link</button>
          {canShare ? <button type="button" className="bl-share" onClick={device}><Share2 size={16} aria-hidden="true" />Share from this device</button> : null}
          <Link
            href={`/messages?tab=members&share=${encodeURIComponent(path)}`}
            scroll={false}
            className="bl-share"
            onClick={() => { void navigator.clipboard?.writeText(url()).catch(() => null); void recordShare(kind, id, "member"); setOpen(false); }}
          >
            <Send size={16} aria-hidden="true" />Send to a member in Messages
          </Link>
          <p className="text-[12px] text-faint">Only people who can see it will be able to open the link.</p>
        </div>
      </Modal>
    </>
  );
}

/**
 * Counts views: items marked with data-view-id are recorded once they've been at least half on screen for a second,
 * in batches, once per page.
 */
export function useViews(kind: "post" | "room_message", root: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  const seen = useRef(new Set<string>());
  const queue = useRef(new Set<string>());
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const flush = () => {
      const ids = [...queue.current];
      queue.current.clear();
      if (ids.length) void recordViews(kind, ids);
    };
    const tick = setInterval(flush, 4000);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.viewId;
        if (!id || seen.current.has(id)) continue;
        if (e.isIntersecting) {
          timers.set(id, setTimeout(() => { seen.current.add(id); queue.current.add(id); }, 1000));
        } else {
          clearTimeout(timers.get(id));
          timers.delete(id);
        }
      }
    }, { threshold: 0.5 });
    el.querySelectorAll<HTMLElement>("[data-view-id]").forEach((n) => io.observe(n));
    return () => { io.disconnect(); clearInterval(tick); timers.forEach(clearTimeout); flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
