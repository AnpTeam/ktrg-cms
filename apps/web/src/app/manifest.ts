import type { MetadataRoute } from "next";

// What "Add to Home Screen" uses: it opens full screen like an app, on the paper colour (the same as the theme colour in layout.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "葛城修験",
    short_name: "葛城修験",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfaf5",
    theme_color: "#fcfaf5",
    icons: [
      // Chrome offers "Install" only with a 192 px and a 512 px PNG; the maskable one has the picture inside the safe zone so Android can crop it to any shape.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
