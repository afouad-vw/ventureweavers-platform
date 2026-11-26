/** Eureka: VentureWeavers' products lab. Each product has its own stages, build log and waiting list. */

export const PRODUCTS = ["quidquo", "handlr"] as const;
export type Product = (typeof PRODUCTS)[number];

export type ProductInfo = {
  key: Product;
  name: string;
  tagline: string;
  description: string;
  /** Waiting-list roles, in order (the database checks the same list). */
  roles: readonly string[];
  /** Logos in /public; null until the product's logo is shared. */
  logo: { onDark: string; onLight: string; mark: string; markOnLight: string } | null;
};

export const PRODUCT_INFO: Record<Product, ProductInfo> = {
  quidquo: {
    key: "quidquo",
    name: "QuidQuo",
    tagline: "AI for capital formation",
    description: "AI for raising capital, built in the open. Follow every stage and be first in when it opens.",
    roles: ["Founder raising capital", "Investor or angel", "Ecosystem partner"],
    logo: {
      onDark: "/brand/products/quidquo/horizontal-on-dark.svg",
      onLight: "/brand/products/quidquo/horizontal-on-light.svg",
      mark: "/brand/products/quidquo/mark-on-dark.svg",
      markOnLight: "/brand/products/quidquo/mark-on-light.svg",
    },
  },
  handlr: {
    key: "handlr",
    name: "Handlr",
    tagline: "AI executive assistant",
    description: "An AI executive assistant for professionals and businesses, built in the open. Follow every stage and be first in when it opens.",
    roles: ["Professional", "Business owner or team", "Executive assistant or operations"],
    logo: null,
  },
};

export function isProduct(v: unknown): v is Product {
  return typeof v === "string" && (PRODUCTS as readonly string[]).includes(v);
}

export function productName(p: string | null | undefined): string {
  return isProduct(p) ? PRODUCT_INFO[p].name : "QuidQuo";
}

export function productHref(p: Product, tab?: "waitlist"): string {
  return `/eureka/${p}${tab ? `?tab=${tab}` : ""}`;
}
