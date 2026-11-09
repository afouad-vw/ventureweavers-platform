"use client";

import { useTransition } from "react";
import { saveSettings } from "@/app/admin/(console)/outloud/actions";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function PaymentSettingsForm({ bankDetails, refundPolicy }: { bankDetails: string; refundPolicy: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveSettings(fd);
          toast(r.ok ? r.message ?? "Saved" : r.error);
        });
      }}
    >
      <TextArea label="Bank details shown to members" name="bank_details" rows={5} defaultValue={bankDetails} placeholder={"Bank: [BANK]\nAccount name: [NAME]\nIBAN: [IBAN]"} hint="Shown after a member reserves, with their payment reference. Until you fill this in, members see [BANK DETAILS]." maxLength={2000} />
      <TextArea label="Cancellation and refund policy" name="refund_policy" rows={3} defaultValue={refundPolicy} placeholder="e.g. Full refund up to 48 hours before the show." hint="Shown on every event page. Empty shows [REFUND POLICY]." maxLength={2000} />
      <Button type="submit" className="self-start" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}
