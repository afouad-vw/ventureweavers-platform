import { cn } from "@/lib/cn";
import { PRODUCT_INFO, type Product } from "@/lib/eureka";

/**
 * A product's logo. `on` is the surface it sits on: "dark" panels use the on-dark artwork,
 * "auto" follows the colour scheme. Products without a logo yet show their name as a wordmark.
 */
export function ProductLogo({ product, on = "auto", variant = "horizontal", className }: { product: Product; on?: "dark" | "auto"; variant?: "horizontal" | "mark"; className?: string }) {
  const info = PRODUCT_INFO[product];
  if (!info.logo) {
    return (
      <span className={cn("inline-flex items-center gap-2 font-display font-semibold tracking-tight", on === "dark" ? "text-white" : "text-fg", className)} role="img" aria-label={info.name}>
        <span className="inline-flex aspect-square h-[1.1em] items-center justify-center rounded-[30%] bg-qq text-[0.62em] text-white" aria-hidden="true">{info.name[0]}</span>
        <span aria-hidden="true">{info.name}</span>
      </span>
    );
  }
  const dark = variant === "mark" ? info.logo.mark : info.logo.onDark;
  const light = variant === "mark" ? info.logo.markOnLight : info.logo.onLight;
  return (
    <picture className={cn("inline-flex", className)}>
      {on === "auto" ? <source srcSet={dark} media="(prefers-color-scheme: dark)" /> : null}
      <img src={on === "dark" ? dark : light} alt={info.name} className="h-full w-auto" />
    </picture>
  );
}
