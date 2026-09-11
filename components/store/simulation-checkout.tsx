"use client";
import {useEffect,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {money,totals,cartError} from "@/lib/store/logic";
import {useStore} from "./provider";
import {Blank,Button,Go,PageHead} from "./shared";
import type {SimulationLine} from "@/lib/payments/simulation-order";

type Order={id:string;created_at:string;items:SimulationLine[];subtotal:number;shipping:number;total:number;channel:string;session_id:string|null;setup_error:string};
type Result={order:Order;payment:{id:string;url:string;status:string;amount:number}|null};
const methods=[["DANA","DANA"],["OVO","OVO"],["SHOPEEPAY","ShopeePay"],["LINKAJA","LinkAja"],["ASTRAPAY","AstraPay"],["GOPAY","GoPay"],["BNI_VIRTUAL_ACCOUNT","VA BNI"],["BRI_VIRTUAL_ACCOUNT","VA BRI"],["BCA_VIRTUAL_ACCOUNT","VA BCA"],["MANDIRI_VIRTUAL_ACCOUNT","VA Mandiri"],["PERMATA_VIRTUAL_ACCOUNT","VA Permata"],["CIMB_VIRTUAL_ACCOUNT","VA CIMB"],["BSI_VIRTUAL_ACCOUNT","VA BSI"]];
const statuses:Record<string,string>={ACTIVE:"Menunggu pembayaran simulasi",COMPLETED:"Simulasi selesai — bukan pembayaran asli",EXPIRED:"Simulasi kedaluwarsa",CANCELED:"Simulasi dibatalkan"};
async function api<T>(path="",body?:unknown):Promise<T>{
  const {data}=await getSupabaseBrowserClient().auth.getSession();
  if(!data.session)throw new Error("Silakan masuk kembali.");
  const response=await fetch(`/api/payments/test-orders${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${data.session.access_token}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Simulasi tidak dapat diproses.");
  return result;
}
function Receipt({value}:{value:Result}){
  const [result,setResult]=useState(value);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  return <section className="panel" style={{overflowWrap:"anywhere"}}>
    <h2>Pesanan Mode Tes</h2><p>SIM-{result.order.id}</p>
    <p role="status">{result.payment?statuses[result.payment.status]:"Sesi pembayaran belum terkonfirmasi"}</p>
    {result.order.items.map(item=><p key={item.slug}>{item.quantity} × {item.title} · {money(item.unit_price)}</p>)}
    <p>Ongkir simulasi: {money(result.order.shipping)}</p><p>Total simulasi: <strong>{money(result.order.total)}</strong></p>
    <p>Tidak masuk pesanan asli, tidak memotong stok, tidak dicatat sebagai pendapatan, dan tidak dikirim.</p>
    {result.payment?.status==="ACTIVE"&&<p><a href={result.payment.url} target="_blank" rel="noopener noreferrer">Buka pembayaran Mode Tes Xendit ↗</a></p>}
    {!result.payment&&<p role="alert">{result.order.setup_error||"Pembuatan sesi sedang berjalan atau hasilnya belum pasti. Periksa kembali; jangan membuat pesanan ganda."}</p>}
    <Button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{setResult(await api<Result>(`?id=${result.order.id}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?"Memeriksa…":"Periksa status dari Xendit"}</Button>
    {error&&<p role="alert">{error}</p>}
    <p>Status diperiksa dari Xendit, bukan dari redirect atau data browser. Pembaruan otomatis melalui webhook belum tersedia.</p>
  </section>;
}

export function SimulationCheckout({onBack}:{onBack:()=>void}){
  const {state,books,booksReady,booksError}=useStore();
  const [channel,setChannel]=useState("DANA"),[courier,setCourier]=useState("Reguler"),[agree,setAgree]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [result,setResult]=useState<Result|null>(null);
  const lock=useRef(false);
  const total=totals(state.cart,books,undefined,courier);
  const invalid=cartError(state.cart,books)|| (state.cart.some(l=>l.format!=="fisik")?"Simulasi checkout hanya untuk buku fisik.":"") || (state.cart.some(l=>books.find(b=>b.slug===l.slug)?.preorder)?"Preorder belum tersedia.":"");
  async function submit(){
    if(lock.current||!agree||invalid)return;
    lock.current=true;setBusy(true);setError("");
    try{
      const storageKey=`fritzoria-simulation-attempt:${state.session}`;
      const fingerprint=JSON.stringify({lines:state.cart,channel,courier,total:total.total});
      let previous:{key?:string;fingerprint?:string}={};
      try{previous=JSON.parse(localStorage.getItem(storageKey)||"{}");}catch{}
      const key=previous.fingerprint===fingerprint&&previous.key?previous.key:crypto.randomUUID();
      localStorage.setItem(storageKey,JSON.stringify({key,fingerprint}));
      const created=await api<Result>("",{key,channel,courier,lines:state.cart,expectedTotal:total.total});
      setResult(created);
      // Keep the attempt key across reloads and retries; the cart intentionally stays unchanged.
    }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  return <div className="wrap">
    <PageHead title="Checkout — Mode Tes" description="Xendit sandbox · Tidak menerima uang sungguhan · Tanpa QRIS"/>
    <p>Tidak memerlukan rekening, alamat, atau nomor HP pribadi. Gunakan simulasi/nomor uji resmi Xendit; jangan transfer uang sungguhan.</p>
    {result?<Receipt key={result.order.id} value={result}/>:<div className="checkout-layout">
      <section className="panel"><h2>Pembayaran simulasi</h2>
        <label htmlFor="simulation-channel">VA / e-wallet — Mode Tes</label>
        <select id="simulation-channel" value={channel} disabled={busy} onChange={e=>setChannel(e.target.value)}>{methods.map(([v,l])=><option key={v} value={v}>{l} — Mode Tes</option>)}</select>
        <label htmlFor="simulation-courier">Ongkir simulasi</label>
        <select id="simulation-courier" value={courier} disabled={busy} onChange={e=>setCourier(e.target.value)}><option>Reguler</option><option>Ekspres</option></select>
        <p>Channel mengikuti ketersediaan Xendit. Simulasi tidak memicu pengiriman atau mengubah keranjang Anda.</p>
      </section>
      <aside className="panel order-summary"><h2>Ringkasan Mode Tes</h2>
        {state.cart.map(l=><p key={l.slug}>{l.qty} × {books.find(b=>b.slug===l.slug)?.title||l.slug}</p>)}
        <p>Subtotal: {money(total.subtotal)}</p><p>Ongkir: {money(total.shipping)}</p><strong>Total simulasi: {money(total.total)}</strong>
        <label className="check-label"><input type="checkbox" checked={agree} disabled={busy} onChange={e=>setAgree(e.target.checked)}/>Saya memahami ini simulasi, bukan pembelian atau pembayaran asli.</label>
        {(error||invalid||booksError)&&<p role="alert" className="form-error">{error||invalid||booksError}</p>}
        <Button disabled={busy||!agree||!!invalid||!booksReady||!!booksError} onClick={()=>void submit()}>{busy?"Membuat simulasi…":"Buat pesanan Mode Tes"}</Button>
      </aside>
    </div>}
    <p><Go href="/pesanan-simulasi" outline>Riwayat pesanan Mode Tes</Go></p>
    <Button variant="outline" disabled={busy} onClick={onBack}>Kembali ke pilihan COD</Button>
  </div>;
}

export function SimulationOrders(){
  const {state,accountReady,isAdmin}=useStore();
  const [orders,setOrders]=useState<Order[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<Result|null>(null);
  useEffect(()=>{if(!accountReady||!isAdmin)return;let canceled=false;
    api<{orders:Order[]}>().then(data=>{if(!canceled)setOrders(data.orders);}).catch(e=>{if(!canceled)setError(e.message);});
    return()=>{canceled=true;};
  },[accountReady,isAdmin,state.session]);
  return <div className="wrap"><PageHead title="Pesanan Mode Tes" description="Riwayat terpisah dari pesanan dan pendapatan asli · 50 percobaan terbaru"/>
    {!accountReady?<p>Memuat akun…</p>:!isAdmin?<Blank title="Akses admin diperlukan" text="Riwayat sandbox khusus admin pemilik simulasi." href="/masuk?next=/pesanan-simulasi" cta="Masuk"/>:<>
      {selected&&<Receipt key={selected.order.id} value={selected}/>}
      {!orders.length&&!error&&<p>Belum ada pesanan simulasi yang dimuat.</p>}
      {orders.map(order=><section className="panel" key={order.id} style={{marginBottom:16,overflowWrap:"anywhere"}}><h2>SIM-{order.id}</h2><p>{order.channel} · {money(order.total)} · {new Date(order.created_at).toLocaleString("id-ID")}</p>
        <Button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{setSelected(await api<Result>(`?id=${order.id}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Lihat dan verifikasi simulasi</Button>
      </section>)}
      {error&&<p role="alert">{error}</p>}
    </>}
    <Go href="/checkout" outline>Kembali ke checkout</Go>
  </div>;
}
