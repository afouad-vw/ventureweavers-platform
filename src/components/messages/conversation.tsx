"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { MESSAGE_MAX, byDay, messageTime, type Message } from "@/lib/messages/format";

type Result = { ok: true } | { ok: false; error: string };

/**
 * A conversation between a member and the VentureWeavers team.
 * Members see team replies as "VentureWeavers"; the team sees who wrote each reply.
 */
export function Conversation({
  messages,
  viewer,
  onSend,
  canSend = true,
  emptyText,
  placeholder = "Write a message",
  className,
  theirName,
  onReport,
}: {
  messages: Message[];
  viewer: "member" | "team";
  onSend: (body: string) => Promise<Result>;
  canSend?: boolean;
  emptyText: React.ReactNode;
  placeholder?: string;
  className?: string;
  /** Member-to-member chats: the other person's name in place of "VentureWeavers". */
  theirName?: string;
  /** Member-to-member chats: a Report link on the other person's messages. */
  onReport?: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Grow the box with the text, up to about 8 lines.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    setError(null);
    start(async () => {
      const r = await onSend(body);
      if (r.ok) setText("");
      else setError(r.error);
    });
  };

  const mine = (m: Message) => (viewer === "member" ? !m.from_team : m.from_team);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={list} className="flex min-h-[260px] flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite" aria-label="Messages">
        {messages.length ? (
          byDay(messages).map((g) => (
            <div key={g.day} className="flex flex-col gap-2">
              <span className="self-center rounded-full bg-hover px-2.5 py-0.5 text-[11.5px] font-bold text-faint">{g.day}</span>
              {g.items.map((m) => (
                <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5 desk:max-w-[70%]", mine(m) ? "items-end self-end" : "items-start self-start")}>
                  <span className="px-1 text-[11.5px] font-bold text-faint">
                    {m.from_team ? (viewer === "member" ? theirName || "VentureWeavers" : m.author || "Team") : viewer === "member" ? "You" : "Member"} · {messageTime(m.created_at)}
                    {onReport && !mine(m) ? (
                      <button type="button" className="ml-2 cursor-pointer font-bold text-faint underline-offset-2 hover:text-fg hover:underline" onClick={() => onReport(m.id)}>Report</button>
                    ) : null}
                  </span>
                  <p
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed break-words whitespace-pre-wrap",
                      mine(m) ? "rounded-br-md bg-deep text-white" : "rounded-bl-md border border-line bg-card text-fg",
                    )}
                  >
                    {m.body}
                  </p>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="m-auto max-w-[360px] text-center text-[13.5px] text-faint">{emptyText}</div>
        )}
      </div>

      {canSend ? (
        <form
          className="flex flex-col gap-1.5 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="flex items-end gap-2">
            <label htmlFor="msg-box" className="sr-only">{placeholder}</label>
            <textarea
              id="msg-box"
              ref={box}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={MESSAGE_MAX}
              placeholder={placeholder}
              className="max-h-[200px] min-h-11 flex-1 resize-none rounded-xl border border-line2 bg-card px-3 py-2.5 text-[14px] placeholder:text-faint focus:border-primary focus:outline-none desk:min-h-10"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label="Send"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40 desk:h-10 desk:w-10"
            >
              <Send size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 px-1 text-[11.5px] text-faint">
            {error ? <span className="font-bold text-bad-fg" role="alert">{error}</span> : <span>Enter to send · Shift+Enter for a new line</span>}
            {text.length > MESSAGE_MAX - 200 ? <span>{MESSAGE_MAX - text.length} left</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
