"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, Flag, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { SelectField, TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { followLabel, REPORT_REASONS, type FollowState, type Visibility } from "@/lib/blong/format";
import {
  blockMember, followMember, removeFollower, reportContent, respondToFollow, startChat, unblockMember, unfollowMember, type ReportKind,
} from "@/app/(member)/blong/actions";

/** Follow / Ask to follow / Requested / Following. Clicking Requested or Following undoes it. */
export function FollowButton({ id, state: initial, visibility, followsMe = false, size = "md" }: {
  id: string; state: FollowState; visibility: Visibility; followsMe?: boolean; size?: "sm" | "md";
}) {
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const on = state !== "none";
  return (
    <Button
      size={size}
      variant={on ? "secondary" : "primary"}
      className={on ? undefined : "bl-follow"}
      disabled={pending}
      aria-pressed={on}
      title={state === "requested" ? "Take back your request" : state === "following" ? "Unfollow" : undefined}
      onClick={() =>
        start(async () => {
          const r = on ? await unfollowMember(id) : await followMember(id);
          if (!r.ok) return toast(r.error);
          const next = on ? "none" : ((r.value as FollowState | undefined) ?? "requested");
          setState(next);
          toast(next === "requested" ? "Request sent" : next === "following" ? "Following" : state === "requested" ? "Request taken back" : "Unfollowed");
          router.refresh();
        })
      }
    >
      {followLabel(state, visibility, followsMe)}
    </Button>
  );
}

/** Opens the chat with a member in Messages › Members. */
export function MessageButton({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      size={size}
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await startChat(id);
          if (!r.ok || !r.value) return toast(r.ok ? "Something went wrong." : r.error);
          router.push(`/messages?tab=members&chat=${r.value}`, { scroll: false });
        })
      }
    >
      <MessageSquare size={15} aria-hidden="true" />Message
    </Button>
  );
}

/** Accept or decline a follow request. */
export function RequestButtons({ id }: { id: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (done) return <span className="text-[12.5px] font-bold text-faint">{done}</span>;
  const act = (accept: boolean) =>
    start(async () => {
      const r = await respondToFollow(id, accept);
      if (!r.ok) return toast(r.error);
      setDone(accept ? "Accepted" : "Declined");
      router.refresh();
    });
  return (
    <span className="flex gap-1.5">
      <Button size="sm" className="bl-follow" disabled={pending} onClick={() => act(true)}><Check size={14} aria-hidden="true" />Accept</Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(false)}><X size={14} aria-hidden="true" />Decline</Button>
    </span>
  );
}

export function RemoveFollowerButton({ id, name }: { id: string; name: string }) {
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (gone) return <span className="text-[12.5px] font-bold text-faint">Removed</span>;
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Remove ${name} from your followers`}
      onClick={() =>
        start(async () => {
          const r = await removeFollower(id);
          if (!r.ok) return toast(r.error);
          setGone(true);
        })
      }
    >
      Remove
    </Button>
  );
}

export function UnblockButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (done) return <span className="text-[12.5px] font-bold text-faint">Unblocked</span>;
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
      const r = await unblockMember(id);
      if (!r.ok) return toast(r.error);
      setDone(true);
    })}>Unblock</Button>
  );
}

/** Report a member or one of their messages. */
export function ReportDialog({ open, onClose, kind, target, name }: { open: boolean; onClose: () => void; kind: ReportKind; target: string; name: string }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Report"
      title={kind === "message" || kind === "room_message" ? `Report a message from ${name}` : `Report ${name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || !reason}
            onClick={() =>
              start(async () => {
                const r = await reportContent(kind, target, reason, details);
                if (!r.ok) return toast(r.error);
                toast("Thanks. The VentureWeavers team will look into it.");
                setReason("");
                setDetails("");
                onClose();
              })
            }
          >
            Send report
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-faint">
        {kind === "message" ? "The team sees only this message, never the rest of your chat. " : kind === "room_message" ? "The team sees only this message. " : ""}
        {kind === "discussion" || kind === "community" ? "The owner isn't told who reported it." : `${name} isn't told who reported them.`}
      </p>
      <SelectField label="What's wrong?" value={reason} onChange={(e) => setReason(e.target.value)} options={[{ value: "", label: "Choose a reason" }, ...REPORT_REASONS]} />
      <TextArea label="Anything else we should know? (optional)" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
      <a className="text-[12.5px] font-bold text-link" href="/terms" target="_blank" rel="noreferrer">Community guidelines</a>
    </Modal>
  );
}

/** Block and Report on a member's page. */
export function MemberSafety({ id, name }: { id: string; name: string }) {
  const [report, setReport] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setReport(true)}><Flag size={14} aria-hidden="true" />Report</Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}><Ban size={14} aria-hidden="true" />Block</Button>
      <ReportDialog open={report} onClose={() => setReport(false)} kind="member" target={id} name={name} />
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Block ${name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await blockMember(id);
                  if (!r.ok) return toast(r.error);
                  toast(`${name} is blocked`);
                  router.push("/blong/networking", { scroll: false });
                })
              }
            >
              Block
            </Button>
          </>
        }
      >
        <p className="text-[13.5px]">
          {name} won&apos;t be able to see your page, follow you or message you, and you&apos;ll stop following each other. They aren&apos;t told. You can unblock them from Profile settings › Privacy.
        </p>
      </Modal>
    </>
  );
}
