"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { ModerationRules } from "@/lib/blong/format";
import { reviewBlongItem, reviewHeldMessage, saveBlongSettings, saveModerationRules, type BlongSettingsPatch } from "./actions";

/** Approve or decline (with a note) one item in the approval queue. */
export function ReviewButtons({ kind, id, name }: { kind: "community" | "discussion"; id: string; name: string }) {
  const [pending, start] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const toast = useToast();
  const router = useRouter();
  const run = (approve: boolean) =>
    start(async () => {
      const r = await reviewBlongItem(kind, id, approve, note);
      if (!r.ok) return toast(r.error);
      setDeclining(false);
      toast(approve ? `${name} is live` : `${name} declined. The member was told.`);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(true)}><Check size={14} aria-hidden="true" />Approve</Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => setDeclining(true)}><X size={14} aria-hidden="true" />Decline</Button>
      <Modal open={declining} onClose={() => setDeclining(false)} title={`Decline ${name}?`} footer={<>
        <Button variant="secondary" onClick={() => setDeclining(false)}>Cancel</Button>
        <Button variant="danger" disabled={pending || !note.trim()} onClick={() => run(false)}>Decline</Button>
      </>}>
        <TextArea label="Note for the member" hint="They see this and can edit and resubmit once." maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change before it can go live?" />
      </Modal>
    </div>
  );
}

/** One on/off setting, saved as soon as it's switched. Turning a section off asks first. */
export function SettingSwitch({ name, label, hint, value, manage, confirmOff }: {
  name: keyof BlongSettingsPatch; label: string; hint: string; value: boolean; manage: boolean; confirmOff?: string;
}) {
  const [on, setOn] = useState(value);
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const save = (next: boolean) =>
    start(async () => {
      setOn(next);
      const r = await saveBlongSettings({ [name]: next });
      if (!r.ok) { setOn(!next); return toast(r.error); }
      toast("Saved");
      router.refresh();
    });
  return (
    <label className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <span className="min-w-0">
        <b className="block text-[14px]">{label}</b>
        <span className="block text-[12.5px] text-faint">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="bl-switch mt-0.5"
        checked={on}
        disabled={!manage || pending}
        onChange={(e) => (!e.target.checked && confirmOff ? setAsk(true) : save(e.target.checked))}
      />
      {confirmOff ? (
        <Modal open={ask} onClose={() => setAsk(false)} title={`Switch off ${label.toLowerCase()}?`} footer={<>
          <Button variant="secondary" onClick={() => setAsk(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setAsk(false); save(false); }}>Switch off</Button>
        </>}>
          <p className="text-[13.5px]">{confirmOff}</p>
        </Modal>
      ) : null}
    </label>
  );
}

/** Publish or Remove for a held or hidden message. */
export function HeldButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (publish: boolean) =>
    start(async () => {
      const r = await reviewHeldMessage(id, publish);
      if (!r.ok) return toast(r.error);
      toast(publish ? "Published. The member was told." : "Removed. The member was told.");
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(true)}><Check size={14} aria-hidden="true" />Publish</Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => run(false)}><X size={14} aria-hidden="true" />Remove</Button>
    </div>
  );
}

const NUMBERS: { name: keyof ModerationRules; label: string; hint: string }[] = [
  { name: "max_links", label: "Links allowed in one message", hint: "More than this is refused." },
  { name: "link_new_days", label: "Days before a member's links go live", hint: "Newer members' links wait for review (refused in chats)." },
  { name: "per_minute", label: "Messages a member can send in a minute", hint: "More than this asks them to slow down." },
  { name: "new_member_days", label: "Days a member counts as new", hint: "New members can't create communities or discussions, and only message people who follow them." },
  { name: "new_member_hold", label: "New members' first messages held", hint: "Their first messages in discussions wait for review." },
  { name: "auto_hide_reports", label: "Reports that hide something", hint: "Reports from different members before a message, community or discussion is hidden for review." },
];

/** The automatic moderation rules form. */
export function RulesForm({ rules, manage }: { rules: ModerationRules; manage: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveModerationRules(f);
          if (!r.ok) return toast(r.error);
          toast("Rules saved");
          router.refresh();
        });
      }}
    >
      <fieldset disabled={!manage || pending} className="flex flex-col gap-3">
        <TextArea name="blocked_words" label="Blocked words and phrases" hint="One per line or separated by commas. English and Arabic. Whole words only, any case." rows={4} defaultValue={rules.blocked_words.join("\n")} />
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-bold text-muted">When a message has a blocked word</span>
          <select name="blocked_action" defaultValue={rules.blocked_action} className="h-9 rounded-xl border border-line2 bg-card px-3 text-[13.5px]">
            <option value="hold">Hold it for review</option>
            <option value="reject">Refuse it (the member is asked to rephrase)</option>
          </select>
          <span className="text-[12px] text-faint">Member-to-member messages are always refused, never held, because the team doesn&apos;t read private chats.</span>
        </label>
        <TextArea name="blocked_domains" label="Blocked sites" hint="Messages linking to these are refused. One per line, like example.com." rows={3} defaultValue={rules.blocked_domains.join("\n")} />
        <div className="grid gap-3 sm:grid-cols-2">
          {NUMBERS.map((n) => (
            <label key={n.name} className="flex flex-col gap-1 text-[13px]">
              <span className="font-bold text-muted">{n.label}</span>
              <input type="number" name={n.name} defaultValue={rules[n.name] as number} className="h-9 rounded-xl border border-line2 bg-card px-3 text-[13.5px]" />
              <span className="text-[12px] text-faint">{n.hint}</span>
            </label>
          ))}
        </div>
        {manage ? <Button type="submit" className="self-start">Save rules</Button> : null}
      </fieldset>
    </form>
  );
}
