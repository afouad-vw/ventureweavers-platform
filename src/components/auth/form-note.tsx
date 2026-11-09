import type { FormState } from "@/lib/auth/form-state";

/** Error or confirmation under an auth form, announced to screen readers. */
export function FormNote({ state }: { state: FormState }) {
  if (!state?.error && !state?.message) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={state.error ? "rounded-lg bg-bad-bg px-3 py-2 text-[13px] font-bold text-bad-fg" : "rounded-lg bg-soft px-3 py-2 text-[13px] font-bold text-soft-fg"}
    >
      {state.error ?? state.message}
    </p>
  );
}
