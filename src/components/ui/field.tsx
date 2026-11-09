import { useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-line2 bg-card px-2.5 text-[13.5px] font-normal text-fg placeholder:text-faint focus:border-primary focus:outline-none";

type Base = { label: string; hint?: string; className?: string };

export function TextField({ label, hint, className, ...props }: Base & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn("flex flex-col gap-1.5 text-[12.5px] font-bold text-muted", className)}>
      {label}
      <input id={props.id ?? id} className={cn(control, "h-10 desk:h-9")} {...props} />
      {hint ? <span className="font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

export function TextArea({ label, hint, className, rows = 3, ...props }: Base & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn("flex flex-col gap-1.5 text-[12.5px] font-bold text-muted", className)}>
      {label}
      <textarea id={props.id ?? id} rows={rows} className={cn(control, "resize-y py-2 leading-snug")} {...props} />
      {hint ? <span className="font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  className,
  options,
  ...props
}: Base & React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly (string | { value: string; label: string })[] }) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn("flex flex-col gap-1.5 text-[12.5px] font-bold text-muted", className)}>
      {label}
      <select id={props.id ?? id} className={cn(control, "h-10 desk:h-9")} {...props}>
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o}>{o}</option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
      {hint ? <span className="font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

/** A labelled checkbox row, used for settings like notification channels. */
export function Toggle({ label, className, ...props }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn("flex min-h-[42px] items-center justify-between gap-3 border-b border-line text-[13.5px] font-semibold last:border-b-0", className)}>
      {label}
      <input id={props.id ?? id} type="checkbox" className="h-[18px] w-[18px] shrink-0 accent-primary" {...props} />
    </label>
  );
}
