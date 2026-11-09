"use client";

import { useActionState } from "react";
import { setNewPassword } from "@/app/(auth)/actions";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(setNewPassword, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <TextField label="New password" name="password" type="password" autoComplete="new-password" minLength={10} hint="At least 10 characters." required />
      <TextField label="Repeat new password" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      <FormNote state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        Save password
      </Button>
    </form>
  );
}
