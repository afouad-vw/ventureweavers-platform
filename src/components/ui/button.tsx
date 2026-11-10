import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "teal" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-bold transition-[filter,background-color] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "border-transparent bg-primary text-white hover:brightness-110",
  secondary: "border-line2 bg-card text-fg hover:bg-hover",
  ghost: "border-transparent bg-transparent text-link hover:bg-hover",
  teal: "border-transparent bg-teal text-ink hover:brightness-105",
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
