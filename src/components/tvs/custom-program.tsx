"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { FORMAT_PREFS, ORG_TYPES } from "@/lib/tvs/custom";
import { sendCustomProgram } from "@/app/(member)/tvs/custom-actions";

/** "Custom programs" on TVS: a short form that goes to the custom-programs inbox. */
export function CustomProgramButton({ defaults }: { defaults: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const close = () => {
    setOpen(false);
    setTimeout(() => { setSent(false); setError(null); }, 200);
  };
  return (
    <>
      <Button variant="teal" className="self-start" onClick={() => setOpen(true)}>Request a meeting</Button>
      <Modal
        open={open}
        onClose={close}
        title={sent ? "Request sent" : "Request a custom program"}
        footer={
          sent ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button disabled={pending} onClick={() => form.current?.requestSubmit()}>
                <Send size={15} aria-hidden="true" />
                {pending ? "Sending…" : "Send"}
              </Button>
            </>
          )
        }
      >
        {sent ? (
          <div className="flex flex-col items-start gap-2 text-[13.5px]">
            <CheckCircle2 size={28} className="text-primary" aria-hidden="true" />
            <p>Thank you. We&apos;ll reply by email within two working days to set up a first conversation.</p>
          </div>
        ) : (
          <form
            ref={form}
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              start(async () => {
                const r = await sendCustomProgram(fd);
                if (r.ok) setSent(true);
                else setError(r.error);
              });
            }}
          >
            <p className="text-[13px] text-muted">For teams, portfolios, cohorts and organisations. Tell us what you need and we&apos;ll shape a program around it.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Your name" name="name" defaultValue={defaults.name} required maxLength={100} autoComplete="name" />
              <TextField label="Email" name="email" type="email" defaultValue={defaults.email} required maxLength={200} autoComplete="email" />
              <TextField label="Organisation" name="organisation" required maxLength={160} autoComplete="organization" />
              <TextField label="Your role" name="role" maxLength={100} autoComplete="organization-title" />
              <SelectField label="It's for" name="for_who" defaultValue="A team" options={ORG_TYPES} />
              <TextField label="Group size" name="size" maxLength={40} placeholder="About 15 people" />
              <SelectField label="Format" name="format" defaultValue="Either" options={FORMAT_PREFS} />
              <TextField label="Timing" name="timing" maxLength={120} placeholder="Q1 2027, or a month" />
            </div>
            <TextArea label="What should the program achieve?" name="goals" rows={4} required maxLength={2000} placeholder="Topics, outcomes, the challenges your people face…" />
            <TextField label="Phone (optional)" name="phone" type="tel" maxLength={40} autoComplete="tel" />
            <TextArea label="Anything else (optional)" name="notes" rows={2} maxLength={1000} />
            <label className="sr-only" aria-hidden="true">
              Leave this empty
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
            {error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{error}</p> : null}
          </form>
        )}
      </Modal>
    </>
  );
}
