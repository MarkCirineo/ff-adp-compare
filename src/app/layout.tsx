import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Draft Edge — Fantasy Football Draft Assistant",
  description:
    "Compare ADP vs rankings across Sleeper, ESPN & Yahoo. Find value picks, steals, and reaches for your fantasy football draft.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          {children}
        </div>
      </body>
    </html>
  );
}
