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
  /** Logos in /public: the main logo for the product's own banner, a white mark for the house icons. */
  logo: { main: string; markWhite: string };
  /** The product's own brand colours, used for its banner and progress (not Eureka's violet). */
  brand: { bg: string; fg: string; muted: string; accent: string; accentText: string };
  /** How tall the main logo is drawn relative to the others, so the wordmarks look the same size. */
  logoScale: number;
};

export const PRODUCT_INFO: Record<Product, ProductInfo> = {
  quidquo: {
    key: "quidquo",
    name: "QuidQuo",
    tagline: "AI for capital formation",
    description: "AI for raising capital, built in the open. Follow every stage and be first in when it opens.",
    roles: ["Founder raising capital", "Investor or angel", "Ecosystem partner"],
    // QuidQuo's full-colour logo sits on its carbon background; lime is its accent.
    logo: { main: "/brand/products/quidquo/horizontal-on-dark.svg", markWhite: "/brand/products/quidquo/mark-mono-bone.svg" },
    brand: { bg: "#0A0B0A", fg: "#F4F6EE", muted: "rgb(244 246 238 / 0.7)", accent: "#A8E01F", accentText: "#0A0B0A" },
    logoScale: 1,
  },
  handlr: {
    key: "handlr",
    name: "Handlr",
    tagline: "AI executive assistant",
    description: "An AI executive assistant for professionals and businesses, built in the open. Follow every stage and be first in when it opens.",
    roles: ["Professional", "Business owner or team", "Executive assistant or operations"],
    // Handlr's main logo (near-black wordmark, violet dots) sits on white; its violet is the accent.
    logo: { main: "/brand/products/handlr/logo.svg", markWhite: "/brand/products/handlr/mark-white.svg" },
    brand: { bg: "#FFFFFF", fg: "#0A0A0B", muted: "rgb(10 10 11 / 0.62)", accent: "#6A00FF", accentText: "#FFFFFF" },
    logoScale: 0.78,
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
