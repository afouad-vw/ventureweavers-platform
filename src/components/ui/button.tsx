import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "teal" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-bold transition-[transform,box-shadow,filter,background-color] duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100";

const variants: Record<Variant, string> = {
  primary: "border-transparent bg-[linear-gradient(180deg,#0b8088,var(--primary))] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(7_17_18/0.15)] hover:brightness-110 hover:shadow-glow hover:-translate-y-px",
  secondary: "border-line2/80 bg-card/70 text-fg backdrop-blur-md shadow-[inset_0_1px_0_var(--glass-hi)] hover:bg-card hover:shadow-depth hover:-translate-y-px",
  ghost: "border-transparent bg-transparent text-link hover:bg-hover",
  teal: "border-transparent bg-[linear-gradient(180deg,#3fd3b0,#29be9c)] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:brightness-105 hover:shadow-glow hover:-translate-y-px",
  danger: "border-transparent bg-bad-bg text-bad-fg hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px] rounded-md",
  md: "h-10 px-3.5 text-[13.5px] desk:h-9",
  lg: "h-11 px-4.5 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

type LinkButtonProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

/** A link styled as a button. Use for navigation; use Button for actions. */
export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
