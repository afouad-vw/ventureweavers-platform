"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { reviewBlongItem, saveBlongSettings, type BlongSettingsPatch } from "./actions";

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
