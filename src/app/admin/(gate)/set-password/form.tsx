"use client";

import { useActionState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { adminSetPassword } from "../actions";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(adminSetPassword, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <TextField label="New password" name="password" type="password" autoComplete="new-password" minLength={12} required />
      <TextField label="Repeat password" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      <FormNote state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        Save and continue
      </Button>
    </form>
  );
}
