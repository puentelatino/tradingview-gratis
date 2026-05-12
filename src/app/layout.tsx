import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://tradingview-gratis.vercel.app";
const OG_IMAGE = "/icons/icon.svg";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TradingView Gratis — Crypto charts open source",
  description:
    "Alternativa open-source y gratis a TradingView Pro. Charts crypto en vivo con indicadores avanzados.",
  manifest: "/manifest.json",
  applicationName: "TV Gratis",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TV Gratis",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.svg", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "TradingView Gratis",
    title: "TradingView Gratis — Crypto charts open source",
    description:
      "Alternativa open-source y gratis a TradingView Pro. Charts crypto en vivo con indicadores avanzados.",
    images: [{ url: OG_IMAGE, width: 512, height: 512, alt: "TV Gratis" }],
  },
  twitter: {
    card: "summary",
    title: "TradingView Gratis",
    description:
      "Alternativa open-source a TradingView Pro. Charts crypto en vivo.",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#131722",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-tv-bg text-tv-text">
        <TooltipProvider delay={150}>{children}</TooltipProvider>
        <RegisterSW />
        <InstallPrompt />
      </body>
    </html>
  );
}
