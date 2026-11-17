"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setWaitlist } from "@/app/(member)/waitlist-actions";
import type { WaitItemType } from "@/lib/waitlist";

/** "Notify me" for a Coming soon item: joins its waitlist; pressed again, leaves it. */
export function NotifyButton({
  type,
  id,
  on: initial,
  signedIn,
  size = "sm",
  variant = "secondary",
  className,
}: {
  type: WaitItemType;
  id: string;
  on: boolean;
  signedIn: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const path = usePathname();
  return (
    <Button
      variant={on ? "secondary" : variant}
      size={size}
      className={className}
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push(`/sign-in?next=${encodeURIComponent(path || "/")}`);
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await setWaitlist(type, id, next);
          if (!r.ok) setOn(!next);
          toast(r.ok ? r.message : r.error);
        });
      }}
    >
      {on ? <Check size={13} strokeWidth={2.4} aria-hidden="true" /> : <Bell size={13} aria-hidden="true" />}
      {on ? "You're on the list" : "Notify me"}
    </Button>
  );
}
