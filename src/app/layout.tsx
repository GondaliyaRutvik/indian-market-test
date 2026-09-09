import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Nifty Dip Alerts",
  description: "Track Indian market indices, get alerted on dips, and see which ETFs track them.",
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
