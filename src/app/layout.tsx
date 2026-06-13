import type { Metadata } from "next";
import Script from "next/script";
import { APP_CONFIG } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
  ),
  title: {
    default: `${APP_CONFIG.name} — Fantasy Football Draft Assistant`,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
  keywords: [
    "fantasy football",
    "draft assistant",
    "ADP comparison",
    "fantasy draft tool",
    "sleeper ADP",
    "ESPN ADP",
    "yahoo ADP",
    "draft rankings",
    "value picks",
    "adp scout",
  ],
  authors: [{ name: APP_CONFIG.name }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: `${APP_CONFIG.name} — Fantasy Football Draft Assistant`,
    description: APP_CONFIG.description,
    siteName: APP_CONFIG.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_CONFIG.name} — Fantasy Football Draft Assistant`,
    description: APP_CONFIG.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-layout">
          {children}
        </div>
        <Script
          defer
          src="https://analytics.markcirineo.com/script.js"
          data-website-id="3c396565-8557-41b6-ae02-c0a15502d7e6"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
