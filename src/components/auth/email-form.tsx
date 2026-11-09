"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

/** Email and password form for members. Phase 2 connects it to Supabase Auth. */
export function EmailPasswordForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const toast = useToast();
  const signUp = mode === "sign-up";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        toast(`Email ${signUp ? "sign-up" : "sign-in"} connects in Phase 2`);
      }}
    >
      {signUp ? <TextField label="Full name" name="name" autoComplete="name" required /> : null}
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
      <Button type="submit" size="lg" className="w-full">
        {signUp ? "Create account" : "Sign in"}
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
