"use client";

import { useActionState } from "react";
import { signInWithProvider } from "@/app/(auth)/actions";
import { FormNote } from "./form-note";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path fill="#fff" d="M7.1 9.4H4.6V19h2.5V9.4zM5.9 5a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9zM19.4 13.6c0-2.6-.6-4.4-3.6-4.4-1.4 0-2.4.8-2.8 1.5V9.4h-2.4V19h2.5v-4.8c0-1.3.2-2.5 1.8-2.5 1.6 0 1.6 1.5 1.6 2.6V19h2.5l.4-5.4z" />
    </svg>
  );
}

const providers = [
  { id: "google", label: "Google", Mark: GoogleMark },
  { id: "linkedin_oidc", label: "LinkedIn", Mark: LinkedInMark },
] as const;

/** Google and LinkedIn sign-in through Supabase Auth. */
export function ProviderButtons({ verb, next }: { verb: "Sign in" | "Sign up"; next?: string }) {
  const [state, action, pending] = useActionState(signInWithProvider, null);
  return (
    <form action={action} className="flex flex-col gap-2.5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {providers.map(({ id, label, Mark }) => (
        <button
          key={id}
          type="submit"
          name="provider"
          value={id}
          disabled={pending}
          className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-line2 bg-card text-[14px] font-bold text-fg hover:bg-hover disabled:cursor-wait disabled:opacity-60"
        >
          <Mark />
          {verb === "Sign in" ? "Continue" : "Sign up"} with {label}
        </button>
      ))}
      <FormNote state={state} />
    </form>
  );
}
