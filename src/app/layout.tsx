import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Nifty Dip Alerts",
  description: "Track Indian market indices, get alerted on dips, and see which ETFs track them.",
  applicationName: "Nifty Dip Alerts",
  // Lets iOS run it as a standalone app from the home screen rather than in a
  // Safari chrome, and keeps the status bar consistent with the dark theme.
  appleWebApp: {
    capable: true,
    title: "Dip Alerts",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
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
