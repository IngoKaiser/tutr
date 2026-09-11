import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Kein Suchindex (D-01). `robots.txt` ist die Bitte, dieser Header die
  // Durchsetzung – er gilt auch für Antworten, die kein HTML sind, und für
  // Crawler, die die robots.txt gar nicht erst lesen. Die App ist das
  // Lernkonto eines Kindes, keine Website.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // Die Content-Security-Policy steht **nicht** hier, sondern in `src/proxy.ts`
  // (S-03a): Sie trägt ein `nonce`, das je Anfrage neu gewürfelt wird, und
  // lässt sich deshalb nicht als feste Kopfzeile ausliefern. Gebaut wird sie
  // in `src/lib/security/csp.ts`.
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
