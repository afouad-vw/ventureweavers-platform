"use client";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

/** Username and password form. Phase 2 checks it on the server; until then it only shows a note. */
export function AdminSignInForm() {
  const toast = useToast();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        toast("Admin sign-in connects in Phase 2");
      }}
    >
      <TextField label="Username" name="username" autoComplete="username" required />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" size="lg" className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}
