"use client";

import { useRef } from "react";
import { useRunner } from "@/components/admin/crud";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { connectCalendly, saveSchedulingSettings } from "./settings-actions";

/** Requests › Scheduling: Karim's Calendly link, the custom programs inbox, and the Calendly connection. */
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
        <TextField label="Calendly link" name="calendly_url" defaultValue={calendly} placeholder="calendly.com/karim-hemdan" hint="When set, Request a meeting (BRICKR, private shows & sponsorships, TVS custom programs) opens this Calendly with the member's name and email filled in. Empty uses the built-in slot picker." />
        <TextField label="Custom programs inbox" name="custom_program_email" type="email" defaultValue={inbox} hint="Where the TVS custom programs form goes when Calendly isn't set." />
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
