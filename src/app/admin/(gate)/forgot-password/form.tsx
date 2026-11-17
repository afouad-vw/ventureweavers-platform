"use client";

import { useActionState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { adminForgotPassword } from "../actions";

export function AdminForgotForm() {
  const [state, action, pending] = useActionState(adminForgotPassword, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <TextField label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required placeholder="ahmed.fouad" />
      <FormNote state={state} />
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a reset link"}
      </Button>
    </form>
  );
}
