"use client";

import { useRef, useState, useTransition } from "react";
import { Briefcase, Check, Link2, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestMeeting, withdrawRequest } from "@/app/(member)/brickr/actions";
import { joinWaitlist, leaveWaitlist } from "@/app/(member)/quidquo/actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { SLOTS, type Day } from "@/lib/brickr/slots";

/** "Request a meeting" pop-up: day, time, company and a note. */
export function RequestButton({
  service,
  days,
  signedIn,
  label = "Request a meeting",
  variant = "primary",
  size = "sm",
  className,
}: {
  service: { id: string; name: string; space: string };
  days: Day[];
  signedIn: boolean;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();
  const Icon = service.space === "Outloud" ? Mic : Briefcase;
  const d = days[day];
  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => (signedIn ? (setError(null), setOpen(true)) : router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`))}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Request a meeting"
        title={service.name}
        footer={
          <>
            <span className="flex-1 text-[12.5px] text-faint">We confirm within 1–2 working days.</span>
            <Button disabled={pending || !d} onClick={() => ref.current?.requestSubmit()}>
              {pending ? "Sending…" : d ? `Request ${d.dow} ${d.day} ${d.month} · ${SLOTS[slot]}` : "Request"}
            </Button>
          </>
        }
      >
        <form
          ref={ref}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await requestMeeting(fd);
              if (r.ok) {
                toast(r.message ?? "Request sent");
                setOpen(false);
                router.refresh();
              } else setError(r.error);
            });
          }}
        >
          <input type="hidden" name="service_id" value={service.id} />
          <input type="hidden" name="day" value={d?.date ?? ""} />
          <input type="hidden" name="slot" value={SLOTS[slot]} />
          <div className="flex items-center gap-2.5">
            <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", service.space === "Outloud" ? "bg-out-bg text-out-fg" : "bg-brk-bg text-brk-fg")}>
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="text-[13px] text-faint">30-minute intro call with both partners</span>
          </div>
          <fieldset>
            <legend className="pb-1.5 text-[12.5px] font-bold text-muted">Day</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {days.map((x, i) => (
                <button
                  key={x.date}
                  type="button"
                  aria-pressed={i === day}
                  onClick={() => setDay(i)}
                  className={cn("flex h-14 cursor-pointer flex-col items-center justify-center rounded-lg border text-[12px]", i === day ? "border-fg bg-fg text-bg" : "border-line2 bg-card hover:bg-hover")}
                >
                  <small className="opacity-80">{x.dow}</small>
                  <b className="font-display text-[16px]">{x.day}</b>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="pb-1.5 text-[12.5px] font-bold text-muted">Time (Cairo)</legend>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {SLOTS.map((t, i) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={i === slot}
                  onClick={() => setSlot(i)}
                  className={cn("h-10 cursor-pointer rounded-lg border text-[13px] font-bold desk:h-9", i === slot ? "border-fg bg-fg text-bg" : "border-line2 bg-card hover:bg-hover")}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-muted">
            Company
            <input name="company" maxLength={160} placeholder="Name and website" className="h-10 rounded-lg border border-line2 bg-card px-2.5 text-[13.5px] font-normal text-fg placeholder:text-faint focus:border-primary focus:outline-none desk:h-9" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-muted">
            What would you like to solve?
            <textarea name="note" rows={3} maxLength={1000} placeholder="A few lines so we come prepared" className="resize-y rounded-lg border border-line2 bg-card px-2.5 py-2 text-[13.5px] font-normal text-fg placeholder:text-faint focus:border-primary focus:outline-none" />
          </label>
          {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}

export function WithdrawButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await withdrawRequest(id);
          toast(r.ok ? r.message ?? "Withdrawn" : r.error);
          if (r.ok) router.refresh();
        })
      }
    >
      Withdraw
    </Button>
  );
}

export const QQ_ROLES = ["Founder raising capital", "Investor or angel", "Ecosystem partner"] as const;

export function WaitlistForm({ signedIn, refCode, current }: { signedIn: boolean; refCode: string | null; current: { role: string; feedback_calls: boolean } | null }) {
  const [role, setRole] = useState(current?.role ?? QQ_ROLES[0]);
  const [feedback, setFeedback] = useState(current?.feedback_calls ?? true);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!signedIn) return router.push(`/sign-in?next=${encodeURIComponent("/quidquo" + (refCode ? `?ref=${refCode}` : ""))}`);
        start(async () => {
          const r = await joinWaitlist(role, feedback, refCode);
          toast(r.ok ? r.message ?? "Saved" : r.error);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="How you'd use QuidQuo">
        {QQ_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={cn("flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-left text-[13.5px] font-semibold", role === r ? "border-qq bg-qq-bg" : "border-line2 bg-card hover:bg-hover")}
          >
            <span className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", role === r ? "border-qq-fg" : "border-line2")}>
              {role === r ? <span className="h-2 w-2 rounded-full bg-qq-fg" /> : null}
            </span>
            {r}
          </button>
        ))}
      </div>
      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-[13.5px] font-bold">
        Invite me to feedback calls
        <input type="checkbox" checked={feedback} onChange={(e) => setFeedback(e.target.checked)} className="h-[18px] w-[18px] accent-primary" />
      </label>
      <Button type="submit" disabled={pending} className="w-full !bg-qq !text-ink hover:brightness-95">
        {pending ? "Saving…" : current ? "Save" : signedIn ? "Join the waitlist" : "Sign in to join"}
      </Button>
    </form>
  );
}

export function CopyInviteButton({ code }: { code: string }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/quidquo?ref=${code}`);
          toast("Invite link copied");
        } catch {
          toast(`Couldn't copy. Your link: ${window.location.origin}/quidquo?ref=${code}`);
        }
      }}
    >
      <Link2 size={15} aria-hidden="true" />
      Copy invite link
    </Button>
  );
}

export function LeaveWaitlistButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await leaveWaitlist();
          toast(r.ok ? r.message ?? "Done" : r.error);
          if (r.ok) router.refresh();
        })
      }
      className="cursor-pointer self-start text-[12.5px] text-faint underline hover:text-fg"
    >
      Leave the waitlist
    </button>
  );
}

export function JoinedMark() {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-qq text-ink">
      <Check size={20} strokeWidth={2.6} aria-hidden="true" />
    </span>
  );
}
