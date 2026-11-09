"use client";

import { useActionState } from "react";
import { FormNote } from "@/components/auth/form-note";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { adminSignIn } from "../actions";

export function AdminSignInForm() {
  const [state, action, pending] = useActionState(adminSignIn, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <TextField label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <Turnstile resetKey={state} />
      <FormNote state={state} />
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
