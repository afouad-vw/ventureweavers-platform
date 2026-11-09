"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithEmail, signUpWithEmail } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormNote } from "./form-note";
import { Turnstile } from "./turnstile";

/** Email and password form for members. */
export function EmailPasswordForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const signUp = mode === "sign-up";
  const [state, action, pending] = useActionState(signUp ? signUpWithEmail : signInWithEmail, null);
  if (signUp && state?.message) return <FormNote state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {signUp ? <TextField label="Full name" name="name" autoComplete="name" maxLength={120} required /> : null}
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete={signUp ? "new-password" : "current-password"}
        minLength={signUp ? 10 : undefined}
        hint={signUp ? "At least 10 characters." : undefined}
        required
      />
      {!signUp ? (
        <Link href="/forgot-password" className="-mt-1 self-end text-[12.5px] font-bold text-link hover:underline">
          Forgot password?
        </Link>
      ) : null}
      <Turnstile />
      <FormNote state={state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : signUp ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs font-bold text-faint" role="separator">
      <span className="h-px flex-1 bg-line" />
      or with email
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
