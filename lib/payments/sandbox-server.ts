import {createClient} from "@supabase/supabase-js";
import {PaymentTestError, publicTestSession, xenditRequest} from "./xendit-test";

export function sandboxDatabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new PaymentTestError("Penyimpanan pembayaran Mode Tes belum dikonfigurasi.",503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}});
}
export async function reconcileSandbox(key:string, sessionId:string, expectedUser?:string, expectedOrder?:string) {
  const session=await xenditRequest(key,`/sessions/${encodeURIComponent(sessionId)}`);
  const meta=session.metadata;
  if(meta?.fritzoria_mode!=="sandbox" || !/^[0-9a-f-]{36}$/i.test(meta?.fritzoria_order_id||"") ||
    (expectedUser&&meta.fritzoria_user_id!==expectedUser) || (expectedOrder&&meta.fritzoria_order_id!==expectedOrder))
    throw new PaymentTestError("Sesi simulasi tidak ditemukan.",404);
  const db=sandboxDatabase();
  const {data:order,error}=await db.from("simulation_orders").select("*")
    .eq("id",meta.fritzoria_order_id).eq("user_id",meta.fritzoria_user_id).maybeSingle();
  if(error) throw new PaymentTestError("Riwayat belum dapat diperiksa.",503);
  if(!order) throw new PaymentTestError("Pesanan simulasi tidak ditemukan.",404);
  const payment=publicTestSession(session,order.user_id,order.total);
  if(payment.id!==sessionId || payment.channel!==order.channel || (order.session_id&&order.session_id!==sessionId))
    throw new PaymentTestError("Sesi pembayaran tidak cocok.",502);
  const {data:saved,error:saveError}=await db.rpc("reconcile_sandbox_payment",{
    p_id:order.id,p_user:order.user_id,p_session:payment.id,p_status:payment.status,p_url:payment.url,
    p_expires:session.expires_at||null});
  if(saveError) throw new PaymentTestError("Status belum tersimpan. Coba periksa kembali.",503);
  return {order:saved,payment:{...payment,status:saved.status}};
}
