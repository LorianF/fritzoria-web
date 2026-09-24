import type { NextConfig } from "next";

function publicSupabaseOrigins() {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
    return { http: origin, websocket: origin.replace(/^https:/, "wss:") };
  } catch {
    return { http: "", websocket: "" };
  }
}

// Fail deployment with an actionable message instead of publishing a broken client.
// Never include environment values in build logs.
if (process.env.VERCEL === "1") {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ] as const;
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Fritzoria: environment kosong atau belum tersedia saat build: ${missing.join(", ")}. Isi Value di Vercel Project Settings > Environment Variables untuk environment deployment ini, simpan, lalu deploy ulang.`,
    );
  }
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (url.protocol !== "https:" || url.pathname !== "/") throw new Error();
  } catch {
    throw new Error("Fritzoria: NEXT_PUBLIC_SUPABASE_URL harus berupa URL dasar HTTPS project Supabase, tanpa /rest/v1, tanda kutip, atau nama variabel.");
  }
}

const supabase = publicSupabaseOrigins();
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase.http} ${supabase.websocket} https://challenges.cloudflare.com`.trim(),
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Resolve product existence/metadata before streaming so missing slugs return 404.
  htmlLimitedBots: /.*/,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
