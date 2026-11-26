import { cn } from "@/lib/cn";
import { PRODUCT_INFO, type Product } from "@/lib/eureka";

/** A product's main logo, sized by its height. It is drawn for the product's own banner colours. */
export function ProductLogo({ product, height, className }: { product: Product; height: number; className?: string }) {
  const info = PRODUCT_INFO[product];
  // eslint-disable-next-line @next/next/no-img-element -- SVG logo, sized by its height
  return <img src={info.logo.main} alt={info.name} style={{ height: Math.round(height * info.logoScale) }} className={cn("w-auto max-w-full", className)} />;
}

/** The product's banner: its main logo on its own brand background. */
export function ProductBanner({ product, className, children }: { product: Product; className?: string; children?: React.ReactNode }) {
  const { brand } = PRODUCT_INFO[product];
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ backgroundColor: brand.bg, color: brand.fg }}>
      {children}
    </div>
  );
}
