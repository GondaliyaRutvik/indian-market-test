import type { MetadataRoute } from "next";

/**
 * Makes the dashboard installable as a real PWA rather than a bookmark.
 *
 * `display: standalone` is what gives it its own window and, on Android, its own
 * persistent storage that survives alongside the browser. On iOS a home-screen
 * app keeps a cookie store separate from Safari, so the first launch after
 * installing will still ask for the password once — after that it persists.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nifty Dip Alerts",
    short_name: "Dip Alerts",
    description:
      "Track Indian market indices, get alerted on dips, and see which ETFs track them.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
