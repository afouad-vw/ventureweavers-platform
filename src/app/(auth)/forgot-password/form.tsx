"use client";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function ResetRequestForm() {
  const toast = useToast();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        toast("Password reset connects in Phase 2");
      }}
    >
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <Button type="submit" size="lg" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
