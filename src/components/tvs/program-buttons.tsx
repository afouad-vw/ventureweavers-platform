"use client";

import { useRef, useState, useTransition } from "react";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { applyToProgram, setProgramInterest } from "@/app/(member)/tvs/actions";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { ROLES, STAGES } from "@/lib/profile/options";

/** Apply to the foundation program: a short form so the cohort fits. */
export function ApplyButton({
  programId,
  programName,
  signedIn,
  defaults,
}: {
  programId: string;
  programName: string;
  signedIn: boolean;
  defaults: { role?: string | null; stage?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <>
      <Button size="sm" onClick={() => (signedIn ? setOpen(true) : router.push("/sign-in?next=%2Ftvs"))}>Apply</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="TVS · Application"
        title={`Apply to ${programName}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={pending} onClick={() => ref.current?.requestSubmit()}>{pending ? "Sending…" : "Send application"}</Button>
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
              const r = await applyToProgram(fd);
              if (r.ok) {
                toast(r.message ?? "Application sent");
                setOpen(false);
                router.refresh();
              } else setError(r.error);
            });
          }}
        >
          <input type="hidden" name="program_id" value={programId} />
          <p className="text-[13px] text-muted">A few questions so the cohort fits. Next is a short intro call with Fouad or Karim.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="What describes you best" name="role" defaultValue={defaults.role && (ROLES as readonly string[]).includes(defaults.role) ? defaults.role : ROLES[0]} options={ROLES} />
            <SelectField label="Stage" name="venture_stage" defaultValue={defaults.stage && STAGES.some(([v]) => v === defaults.stage) ? defaults.stage : ""} options={[{ value: "", label: "Choose" }, ...STAGES.map(([v]) => ({ value: v, label: v }))]} />
          </div>
          <TextArea label="What are you building or working on?" name="building" rows={3} required minLength={10} maxLength={1000} />
          <TextArea label="Why now? (optional)" name="why_now" rows={2} maxLength={1000} />
          {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
        </form>
      </Modal>
    </>
  );
}

export function NotifyButton({ programId, on: initial, signedIn }: { programId: string; on: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push("/sign-in?next=%2Ftvs");
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await setProgramInterest(programId, next);
          if (!r.ok) setOn(!next);
          toast(r.ok ? r.message ?? "Saved" : r.error);
        });
      }}
    >
      {on ? <Check size={13} strokeWidth={2.4} aria-hidden="true" /> : <Bell size={13} aria-hidden="true" />}
      {on ? "Notifying you" : "Notify me"}
    </Button>
  );
}

export function DatesButton({ name }: { name: string }) {
  const toast = useToast();
  return (
    <Button size="sm" onClick={() => toast(`${name} intake dates are announced after each TVAC cohort.`)}>See dates</Button>
  );
}
