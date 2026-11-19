import type { Metadata, Viewport } from "next";
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import "@fontsource/nunito-sans/800.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { hostConfig } from "@/lib/hosts";

const SHARE_IMAGE = { url: "/images/og-logo.png", width: 1200, height: 630, alt: "VentureWeavers", type: "image/png" };

export const metadata: Metadata = {
  metadataBase: new URL(`https://${hostConfig().app}`),
  title: { default: "VentureWeavers", template: "%s · VentureWeavers" },
  description: "Shows, programs, services and resources from Ahmed Fouad and Karim Hemdan.",
  applicationName: "VentureWeavers",
  openGraph: { type: "website", siteName: "VentureWeavers", locale: "en_US", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
};

export const viewport: Viewport = {
  themeColor: "#071112",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
