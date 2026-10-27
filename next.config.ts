import type { NextConfig } from "next";

const csp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    // React dev tooling needs eval; production never does.
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    `frame-ancestors ${frameAncestors}`,
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp("'none'") },
];

// The admin live-preview embeds /preview in a same-origin iframe.
const previewHeaders = [
  ...securityHeaders.filter((h) => h.key !== "X-Frame-Options" && h.key !== "Content-Security-Policy"),
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: csp("'self'") },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      { source: "/((?!preview$).*)", headers: securityHeaders },
      { source: "/preview", headers: previewHeaders },
    ];
  },
};

export default nextConfig;
