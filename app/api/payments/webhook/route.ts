import {timingSafeEqual} from "node:crypto";
import {testKey,PaymentTestError} from "@/lib/payments/xendit-test";
import {reconcileSandbox} from "@/lib/payments/sandbox-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  try {
    const key=testKey();
    const expected=process.env.XENDIT_WEBHOOK_TOKEN?.trim();
    if(!expected) return Response.json({error:"Webhook belum dikonfigurasi."},{status:503});
    const received=request.headers.get("x-callback-token")||"";
    const a=Buffer.from(expected), b=Buffer.from(received);
    if(a.length!==b.length||!timingSafeEqual(a,b)) return Response.json({error:"Unauthorized"},{status:401});
    const raw=await request.text();
    if(raw.length>64000) return Response.json({error:"Payload too large"},{status:413});
    let body;try{body=JSON.parse(raw);}catch{return Response.json({error:"Invalid JSON"},{status:400});}
    if(!["payment_session.completed","payment_session.expired"].includes(body?.event))return Response.json({received:true,ignored:true});
    const id=body?.data?.payment_session_id;
    if(typeof id!=="string"||!/^ps-[a-zA-Z0-9-]{20,64}$/.test(id))return Response.json({error:"Invalid session"},{status:400});
    // Re-read with the sandbox key; never trust incoming amount/status/ownership.
    await reconcileSandbox(key,id);
    return Response.json({received:true});
  }catch(error){
    if(error instanceof PaymentTestError&&error.status===404)return Response.json({received:true,ignored:true});
    console.error("sandbox_webhook_reconciliation_failed");
    return Response.json({error:"Reconciliation pending; retry required."},{status:503});
  }
}
