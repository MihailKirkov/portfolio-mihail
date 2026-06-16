import type { Metadata, Viewport } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Mihail Kirkov — Full-Stack Developer · AI Integration",
  description:
    "Full-stack developer (React/Next.js · Node.js · PHP/Python) with 2+ years of production experience and hands-on AI integration. EU citizen, relocating to Eindhoven September 2026.",
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
        {children}
        <div className="fx-vignette" aria-hidden="true" />
        <div className="fx-scanline" aria-hidden="true" />
      </body>
    </html>
  );
}
