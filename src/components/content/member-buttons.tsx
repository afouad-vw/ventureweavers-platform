"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Download, Link2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { openResource, setNewsletter, suggestTopic, toggleSaved } from "@/app/(member)/content-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

/** Bookmark button for blog posts, Library resources and feed posts. Sends visitors to sign in. */
export function SaveButton({
  type,
  id,
  saved: initial,
  signedIn,
  compact,
}: {
  type: "blog" | "resource" | "post";
  id: string;
  saved: boolean;
  signedIn: boolean;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <Button
      variant={compact ? "ghost" : "secondary"}
      size="sm"
      aria-pressed={saved}
      aria-label={compact ? (saved ? "Saved" : "Save") : undefined}
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        const next = !saved;
        setSaved(next);
        start(async () => {
          const r = await toggleSaved(type, id, next);
          if (!r.ok) setSaved(!next);
          toast(r.ok ? r.message ?? "Done" : r.error);
        });
      }}
    >
      <Icon size={14} aria-hidden="true" />
      {compact ? null : saved ? "Saved" : "Save"}
    </Button>
  );
}

export function CopyLinkButton() {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          toast("Link copied");
        } catch {
          toast("Couldn't copy. Copy the address from your browser bar.");
        }
      }}
    >
      <Link2 size={14} aria-hidden="true" />
      Copy link
    </Button>
  );
}

/** Library "Get" button: asks the server for a short-lived link, then opens it. */
export function GetResourceButton({ id, isSkill, locked, available }: { id: string; isSkill: boolean; locked: boolean; available: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  if (locked) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Lock size={13} aria-hidden="true" />
        Locked
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending || !available}
      onClick={() => {
        // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the link.
        const tab = window.open("about:blank", "_blank");
        start(async () => {
          const r = await openResource(id);
          if (r.ok) {
            if (tab) {
              tab.opener = null;
              tab.location.href = r.url;
            } else window.location.href = r.url;
          } else {
            tab?.close();
            toast(r.error);
          }
        });
      }}
    >
      <Download size={14} aria-hidden="true" />
      {!available ? "Coming soon" : pending ? "Opening…" : isSkill ? "Get skill" : "Get"}
    </Button>
  );
}

export function TopicForm({ signedIn }: { signedIn: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      id="topic"
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!signedIn) return router.push("/sign-in?next=%2Foutloud%23topic");
        start(async () => {
          const r = await suggestTopic(text);
          toast(r.ok ? r.message ?? "Sent" : r.error);
          if (r.ok) setText("");
        });
      }}
    >
      <label htmlFor="topicIn" className="flex flex-col gap-1.5 text-[12.5px] font-bold text-muted">
        What should we discuss at the next show?
        <textarea
          id="topicIn"
          rows={3}
          required
          minLength={5}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. How do I price a B2B product in Egypt?"
          className="w-full resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] leading-snug font-normal text-fg placeholder:text-faint focus:border-primary focus:outline-none"
        />
      </label>
      <Button type="submit" className="self-start" disabled={pending}>{pending ? "Sending…" : "Send topic"}</Button>
    </form>
  );
}

export function NewsletterToggle({ on: initial, signedIn }: { on: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <label className={cn("flex min-h-10 cursor-pointer items-center justify-between gap-3 text-[13.5px] font-bold", pending && "opacity-60")}>
      Send it to my email
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        className="h-[18px] w-[18px] accent-primary"
        onChange={(e) => {
          if (!signedIn) return router.push("/sign-in?next=%2Foutloud%3Ftab%3Dblog");
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await setNewsletter(next);
            if (!r.ok) setOn(!next);
            toast(r.ok ? r.message ?? "Saved" : r.error);
          });
        }}
      />
    </label>
  );
}
