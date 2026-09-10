import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  // Resolve product existence/metadata before streaming so missing slugs return 404.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
