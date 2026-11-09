"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { FormNote } from "@/components/auth/form-note";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.message) return <FormNote state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <Turnstile resetKey={state} />
      <FormNote state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        Send reset link
      </Button>
    </form>
  );
}
