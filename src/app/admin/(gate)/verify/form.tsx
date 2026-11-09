"use client";

import { useActionState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { adminVerify } from "../actions";

export function VerifyForm({ factorId }: { factorId: string }) {
  const [state, action, pending] = useActionState(adminVerify, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="factorId" value={factorId} />
      <TextField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
      <FormNote state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Verify"}
      </Button>
    </form>
  );
}
