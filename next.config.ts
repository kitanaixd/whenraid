import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Illustrations des images d'aperçu (opengraph-image.tsx), lues sur le disque au rendu.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/**/*"],
    "/annonces/*/opengraph-image": ["./assets/og/**/*"],
    "/**/opengraph-image*/**": ["./assets/og/**/*"],
  },
};

export default nextConfig;
