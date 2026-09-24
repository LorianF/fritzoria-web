import { testCustomerContext, testKey, testPayload, publicTestSession, xenditRequest, PaymentTestError, TEST_CHANNELS } from "@/lib/payments/xendit-test";
import { sandboxDatabase, reconcileSandbox } from "@/lib/payments/sandbox-server";
import { parseSimulationLines, simulationQuote } from "@/lib/payments/simulation-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(error: unknown) {
  return Response.json({error: error instanceof PaymentTestError ? error.message : "Pesanan simulasi belum dapat diproses."},
    {status: error instanceof PaymentTestError ? error.status : 500, headers});
}
export async function GET(request: Request) {
  try {
    const key = testKey();
    const {db,userId} = await testCustomerContext(request);
    const id = new URL(request.url).searchParams.get("id");
    if (id && !uuid.test(id)) throw new PaymentTestError("ID pesanan simulasi tidak valid.");
    if (id) {
      const {data,error} = await db.from("simulation_orders").select("*").eq("user_id",userId).eq("id",id).maybeSingle();
      if (error) throw new PaymentTestError("Riwayat simulasi tidak dapat dimuat.",503);
      if (!data) throw new PaymentTestError("Pesanan simulasi tidak ditemukan.",404);
      return Response.json(data.session_id ? await reconcileSandbox(key,data.session_id,userId,data.id) : {order:data,payment:null}, {headers});
    }
    const {data,error} = await db.from("simulation_orders").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(50);
    if (error) throw new PaymentTestError("Riwayat simulasi tidak dapat dimuat. Periksa migrasi sandbox.",503);
    return Response.json({orders:data}, {headers});
  } catch(error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const key = testKey();
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) throw new PaymentTestError("Origin tidak diizinkan.",403);
    const {userId} = await testCustomerContext(request);
    const db = sandboxDatabase();
    const raw = await request.text();
    if (raw.length>16000) throw new PaymentTestError("Permintaan terlalu besar.",413);
    let body;
    try { body=JSON.parse(raw); } catch { throw new PaymentTestError("Permintaan tidak valid."); }
    if (!body || !uuid.test(body.key) || !TEST_CHANNELS.includes(body.channel)) throw new PaymentTestError("Metode atau referensi simulasi tidak valid.");
    let lines;
    try { lines=parseSimulationLines(body.lines); } catch(error) { throw new PaymentTestError((error as Error).message); }
    const existing = await db.from("simulation_orders").select("*").eq("user_id",userId).eq("id",body.key).maybeSingle();
    if (existing.error) {
      console.error("sandbox_order_lookup_failed", {
        code: existing.error.code || "unknown",
        message: existing.error.message || "unknown",
        details: existing.error.details || "",
      });
      throw new PaymentTestError("Penyimpanan simulasi belum tersedia.",503);
    }
    if (existing.data) {
      if (!existing.data.session_id) throw new PaymentTestError("Percobaan ini sudah tercatat; buka Riwayat Mode Tes untuk memeriksa hasilnya. Tidak dibuat sesi ganda.",409);
      return Response.json(await reconcileSandbox(key,existing.data.session_id,userId,existing.data.id), {headers});
    }
    const catalog = await db.from("books").select("slug,title,physical_price,stock,hidden,preorder").in("slug",lines.map(l=>l.slug)).eq("hidden",false);
    if (catalog.error) throw new PaymentTestError("Harga buku tidak dapat diperiksa.",503);
    let quote;
    try { quote=simulationQuote(lines,catalog.data || [],body.courier); } catch(error) { throw new PaymentTestError((error as Error).message); }
    if (body.expectedTotal!==quote.total) throw new PaymentTestError("Harga telah berubah. Muat ulang checkout sebelum mencoba lagi.",409);
    const inserted = await db.rpc("reserve_sandbox_order", {p_id:body.key,p_user:userId,p_channel:body.channel,p_courier:body.courier,
      p_items:quote.items,p_subtotal:quote.subtotal,p_shipping:quote.shipping,p_total:quote.total});
    if (inserted.error) throw new PaymentTestError("Stok sandbox sedang direservasi, harga berubah, atau batas 20 percobaan per jam tercapai. Periksa riwayat dan coba kembali nanti.",409);
    if (!inserted.data.created) throw new PaymentTestError("Percobaan sudah berjalan. Periksa riwayat sebelum mencoba lagi.",409);
    const returnUrl=new URL("/pesanan-simulasi",origin);returnUrl.searchParams.set("id",body.key);
    const payload={...testPayload(userId,body.channel,`FRTEST-${body.key}`),amount:quote.total,
      description:"MODE TES Fritzoria — tanpa uang asli dan tanpa pengiriman",
      expires_at:inserted.data.order.expires_at,locale:"id",
      success_return_url:returnUrl.href,cancel_return_url:returnUrl.href,
      metadata:{fritzoria_mode:"sandbox",fritzoria_user_id:userId,fritzoria_order_id:body.key},
      items:quote.items.map(item=>({reference_id:item.slug,name:item.title,type:"PHYSICAL_PRODUCT",category:"BOOKS",quantity:item.quantity,net_unit_amount:item.unit_price})),
    };
    if (quote.shipping) payload.items.push({reference_id:"shipping",name:"Ongkir simulasi",type:"FEE",category:"SHIPPING",quantity:1,net_unit_amount:quote.shipping});
    try {
      const data=await xenditRequest(key,"/sessions",payload);
      const payment=publicTestSession(data,userId,quote.total);
      if(data.metadata?.fritzoria_order_id!==body.key || payment.channel!==body.channel)throw new PaymentTestError("Sesi pembayaran tidak cocok.",502);
      const saved=await db.rpc("reconcile_sandbox_payment",{p_id:body.key,p_user:userId,p_session:payment.id,
        p_status:payment.status,p_url:payment.url,p_expires:data.expires_at||inserted.data.order.expires_at});
      if (saved.error) throw new PaymentTestError("Sesi dibuat, tetapi penyimpanan belum terkonfirmasi. Periksa riwayat; jangan membuat ulang.",503);
      return Response.json({order:saved.data,payment:{...payment,status:saved.data.status}}, {status:201,headers});
    } catch(error) {
      const message=error instanceof PaymentTestError ? error.message : "Hasil Xendit belum terkonfirmasi; periksa dashboard Mode Tes.";
      await db.from("simulation_orders").update({setup_error:message}).eq("id",body.key).eq("user_id",userId).eq("status","PENDING");
      throw error;
    }
  } catch(error) { return fail(error); }
}
