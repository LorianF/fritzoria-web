// Server-side sandbox integration. Never import this module into a Client Component.
import { createClient } from "@supabase/supabase-js";

export class PaymentTestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const TEST_CHANNELS = [
  "BCA_VIRTUAL_ACCOUNT", "BNI_VIRTUAL_ACCOUNT", "BRI_VIRTUAL_ACCOUNT",
  "MANDIRI_VIRTUAL_ACCOUNT", "PERMATA_VIRTUAL_ACCOUNT", "CIMB_VIRTUAL_ACCOUNT",
  "BSI_VIRTUAL_ACCOUNT", "DANA", "OVO", "SHOPEEPAY", "LINKAJA", "ASTRAPAY", "GOPAY",
];

export function testEnvironmentEnabled(env = process.env) {
  return env.VERCEL_ENV === "preview" || (env.VERCEL_ENV === "production" && env.XENDIT_SANDBOX_ENABLED === "true");
}

export function testKey(env = process.env) {
  // Production requires explicit sandbox opt-in; live keys are always rejected.
  if (!testEnvironmentEnabled(env)) throw new PaymentTestError("Mode Tes belum diaktifkan pada deployment ini.", 404);
  const key = env.XENDIT_SECRET_KEY?.trim();
  if (!key?.startsWith("xnd_development_")) {
    throw new PaymentTestError("Secret API Key Xendit Mode Tes belum dikonfigurasi dengan benar.", 503);
  }
  return key;
}

export async function testCustomerContext(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new PaymentTestError("Masuk untuk melakukan pembayaran Mode Tes.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new PaymentTestError("Konfigurasi autentikasi belum tersedia.", 503);
  // Publishable key + caller JWT only. All database access remains subject to RLS.
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new PaymentTestError("Sesi tidak valid. Silakan masuk kembali.", 401);
  return { userId: data.user.id, db };
}

export async function testAdminContext(request: Request) {
  const {db, userId} = await testCustomerContext(request);
  const profile = await db.from("profiles").select("role").eq("id", userId).single();
  if (profile.error || profile.data?.role !== "admin") throw new PaymentTestError("Simulasi hanya untuk admin.", 403);
  return { userId, db };
}

export async function requireTestAdmin(request: Request) {
  return (await testAdminContext(request)).userId;
}

export function testPayload(userId: string, channel: string, reference: string) {
  if (!TEST_CHANNELS.includes(channel)) throw new PaymentTestError("Pilih VA atau e-wallet yang tersedia; QRIS tidak didukung.");
  return {
    reference_id: reference,
    session_type: "PAY", mode: "PAYMENT_LINK", country: "ID", currency: "IDR",
    amount: 10000, // Fixed test amount; cannot be changed by the browser.
    allowed_payment_channels: [channel],
    allow_save_payment_method: "DISABLED",
    description: "SIMULASI Fritzoria Rp10.000 — bukan pesanan, tidak ada pengiriman barang",
    customer: { reference_id: `fritzoriatest${reference.replaceAll(/[^a-zA-Z0-9]/g, "")}`,
      type: "INDIVIDUAL", individual_detail: { given_names: "Fritzoria Test" } },
    metadata: { fritzoria_mode: "sandbox", fritzoria_user_id: userId },
  };
}

export async function xenditRequest(key: string, path: string, payload?: unknown) {
  let response: Response;
  try {
    response = await fetch(`https://api.xendit.co${path}`, {
      method: payload ? "POST" : "GET",
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new PaymentTestError("Xendit belum merespons. Periksa dashboard Mode Tes sebelum membuat simulasi baru.", 502);
  }
  if (!response.ok) {
    // Never forward provider response bodies: they can contain sensitive information.
    const errorBody = await response.json().catch(() => ({}));
    const code = ["DUPLICATE_ERROR", "API_VALIDATION_ERROR", "INVALID_PAYMENT_CHANNEL", "INVALID_AMOUNT", "INVALID_URL", "MISSING_CUSTOMER"].includes(errorBody?.error_code) ? errorBody.error_code : "";
    const message = response.status === 401 || response.status === 403
      ? "Xendit menolak akses. Periksa izin API key Mode Tes untuk Payments / Payment Sessions."
      : response.status === 404 ? "Sesi simulasi tidak ditemukan."
      : "Xendit menolak permintaan. Periksa aktivasi channel dan log API Mode Tes di dashboard.";
    throw new PaymentTestError(`${message}${code ? ` (${code})` : ""}`, response.status === 404 ? 404 : 502);
  }
  return response.json();
}

export function publicTestSession(data: Record<string, unknown>, userId: string, expectedAmount = 10000) {
  const metadata = data.metadata as Record<string, unknown> | undefined;
  if (metadata?.fritzoria_mode !== "sandbox" || metadata.fritzoria_user_id !== userId) {
    throw new PaymentTestError("Sesi simulasi tidak ditemukan.", 404);
  }
  if (data.amount !== expectedAmount || data.currency !== "IDR") throw new PaymentTestError("Data simulasi tidak sesuai.", 502);
  const channels = data.allowed_payment_channels;
  if (!Array.isArray(channels) || channels.length !== 1 || !TEST_CHANNELS.includes(channels[0])) {
    throw new PaymentTestError("Channel simulasi tidak sesuai.", 502);
  }
  let url: URL | undefined;
  try { if (data.payment_link_url) url = new URL(String(data.payment_link_url)); } catch { /* rejected below */ }
  if ((!url && (data.status === "ACTIVE" || data.payment_link_url != null)) || (url && (url.protocol !== "https:" || url.username || url.password ||
    !["checkout-staging.xendit.co", "dev.xen.to"].includes(url.hostname)))) {
    throw new PaymentTestError("Xendit tidak mengembalikan tautan Mode Tes yang dikenal.", 502);
  }
  if (!/^ps-[a-zA-Z0-9-]{20,64}$/.test(String(data.payment_session_id)) ||
    !["ACTIVE", "COMPLETED", "EXPIRED", "CANCELED"].includes(String(data.status))) {
    throw new PaymentTestError("Respons sesi Xendit tidak valid.", 502);
  }
  return { id: String(data.payment_session_id), url: url?.href || "", status: String(data.status), amount: expectedAmount, channel: channels[0] as string };
}
