import type { Metadata, Viewport } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { Background } from "@/components/hud/background";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-orbitron",
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-share-tech",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title =
  "Mihail Kirkov — Full-Stack Developer (React/Next · Node · PHP · AI)";
const description =
  "Full-stack developer with 2+ years production experience and hands-on AI integration. EU citizen relocating to Eindhoven, September 2026 — available August. React/Next, Node/PHP, and Claude-powered apps.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Mihail Kirkov",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#04080f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${orbitron.variable} ${shareTechMono.variable}`}>
      <body>
        <Background />
        {children}
        <div className="fx-vignette" aria-hidden="true" />
        <div className="fx-scanline" aria-hidden="true" />
      </body>
    </html>
  );
}
