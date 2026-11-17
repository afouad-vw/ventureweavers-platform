"use client";

import { useState, useTransition } from "react";
import { Download, Lock, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/events/format";

type Result = { ok: true; message?: string } | { ok: false; error: string };
export type ThreadComment = { id: string; body: string; author: string; staff: boolean; internal: boolean; created_at: string };

/**
 * Comments on the project, a request or a meeting. Staff can tick "Team only" (internal);
 * clients never see internal comments (row level security).
 */
export function CommentThread({
  comments,
  post,
  staff = false,
  placeholder = "Add a comment",
  compact = false,
}: {
  comments: ThreadComment[];
  post: (body: string, internal: boolean) => Promise<Result>;
  staff?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [open, setOpen] = useState(!compact || comments.length > 0);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex cursor-pointer items-center gap-1.5 self-start text-[12.5px] font-bold text-link hover:underline">
        <MessageSquare size={13} aria-hidden="true" />Comment
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {comments.length ? (
        <ul className="flex flex-col gap-1.5">
          {comments.map((c) => (
            <li key={c.id} className={`rounded-xl px-3 py-2 text-[13px] ${c.internal ? "border border-dashed border-warn-fg/40 bg-warn-bg/40" : c.staff ? "bg-soft" : "bg-hover"}`}>
              <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-faint">
                <b className="text-fg">{c.author}</b>
                {formatDateTime(c.created_at)}
                {c.internal ? <span className="inline-flex items-center gap-1 font-bold text-warn-fg"><Lock size={11} aria-hidden="true" />Team only</span> : null}
              </span>
              <p className="mt-0.5 whitespace-pre-line">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          start(async () => {
            const r = await post(body, staff && internal);
            toast(r.ok ? r.message ?? "Posted" : r.error);
            if (r.ok) setBody("");
          });
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={compact ? 1 : 2}
            maxLength={2000}
            placeholder={placeholder}
            aria-label={placeholder}
            className="min-h-10 w-full flex-1 resize-y rounded-lg border border-line2 bg-card px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" disabled={pending || !body.trim()} aria-label="Post comment"><Send size={14} aria-hidden="true" /></Button>
        </div>
        {staff ? (
          <label className="inline-flex items-center gap-2 self-start text-[12.5px] font-bold text-muted">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-primary" />
            Team only (the client won&apos;t see it)
          </label>
        ) : null}
      </form>
    </div>
  );
}

/** Downloads the proposal through a 5-minute link. */
export function ProposalButton({ getLink, label = "Download proposal", variant = "primary" }: { getLink: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>; label?: string; variant?: "primary" | "secondary" }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await getLink();
          if (r.ok) window.location.href = r.url;
          else toast(r.error);
        })
      }
    >
      <Download size={15} aria-hidden="true" />
      {pending ? "Opening…" : label}
    </Button>
  );
}
