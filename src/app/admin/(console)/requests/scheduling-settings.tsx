"use client";

import { useRef } from "react";
import { useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { connectCalendly, saveSchedulingSettings } from "./settings-actions";

/** Requests › Scheduling: the default Calendly link, the private programs inbox, and the Calendly connection. */
export function SchedulingSettings({ calendly, inbox, keysSet }: { calendly: string; inbox: string; keysSet: boolean }) {
  const r = useRunner();
  const form = useRef<HTMLFormElement>(null);
  return (
    <Card className="max-w-[720px]">
      <CardHeader title="Scheduling" />
      <form
        ref={form}
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          r.run(() => saveSchedulingSettings(new FormData(e.currentTarget)));
        }}
      >
        <TextField label="Default Calendly link" name="calendly_url" defaultValue={calendly} placeholder="calendly.com/karim-hemdan" hint="Suggested for new services. Each service sets its own way to meet (request, calendar or both) and its own Calendly link in BRICKR › Services." />
        <TextField label="Private programs inbox" name="custom_program_email" type="email" defaultValue={inbox} hint="Where the TVS Private programs and Private classes forms go when those services don't use a calendar." />
        {r.error ? <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg">{r.error}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={r.pending}>Save</Button>
          <Button variant="secondary" disabled={r.pending || !keysSet} onClick={() => r.run(() => connectCalendly())}>Connect Calendly</Button>
          <span className="text-[12.5px] text-faint">
            {keysSet
              ? "Connect once so cancellations in Calendly update the inbox."
              : "To track cancellations and exact times, add CALENDLY_TOKEN and CALENDLY_SIGNING_KEY in Vercel, then connect."}
          </span>
        </div>
      </form>
    </Card>
  );
}
