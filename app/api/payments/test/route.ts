import { randomUUID } from "node:crypto";
import { PaymentTestError, testKey, requireTestAdmin, testPayload, xenditRequest, publicTestSession } from "@/lib/payments/xendit-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
function fail(error: unknown) {
  return Response.json({ error: error instanceof PaymentTestError ? error.message : "Simulasi belum dapat diproses." },
    { status: error instanceof PaymentTestError ? error.status : 500, headers });
}

export async function POST(request: Request) {
  try {
    const key = testKey();
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    // Next.js may normalize request.url to an internal hostname behind a proxy.
    if (!origin || !host || !["https:", "http:"].includes(new URL(origin).protocol) || new URL(origin).host !== host) {
      throw new PaymentTestError("Origin tidak diizinkan.", 403);
    }
    const userId = await requireTestAdmin(request);
    const raw = await request.text();
    if (raw.length > 1024) throw new PaymentTestError("Permintaan terlalu besar.", 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new PaymentTestError("Permintaan tidak valid."); }
    const payload = testPayload(userId, body?.channel, `FRTEST-${randomUUID()}`);
    const result = await xenditRequest(key, "/sessions", payload);
    return Response.json(publicTestSession(result, userId), { status: 201, headers });
  } catch (error) { return fail(error); }
}

export async function GET(request: Request) {
  try {
    const key = testKey();
    const userId = await requireTestAdmin(request);
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!/^ps-[a-zA-Z0-9-]{20,64}$/.test(id)) throw new PaymentTestError("ID sesi tidak valid.");
    const result = await xenditRequest(key, `/sessions/${encodeURIComponent(id)}`);
    return Response.json(publicTestSession(result, userId), { headers });
  } catch (error) { return fail(error); }
}
