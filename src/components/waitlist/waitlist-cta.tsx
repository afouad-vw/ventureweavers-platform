import { getMember } from "@/lib/auth/guards";
import { myWaitlist } from "@/lib/waitlist-server";
import { waitKey, type WaitItemType } from "@/lib/waitlist";
import type { ButtonProps } from "@/components/ui/button";
import { NotifyButton } from "./notify-button";

/** Server wrapper for Notify me: reads whether the member is already on the list. */
export async function WaitlistCta({ type, id, size, variant, className }: { type: WaitItemType; id: string; size?: ButtonProps["size"]; variant?: ButtonProps["variant"]; className?: string }) {
  const [me, list] = await Promise.all([getMember(), myWaitlist()]);
  return <NotifyButton type={type} id={id} on={list.has(waitKey(type, id))} signedIn={!!me} size={size} variant={variant} className={className} />;
}
