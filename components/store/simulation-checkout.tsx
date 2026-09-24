"use client";
import {useEffect,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {money,totals,cartError} from "@/lib/store/logic";
import {useStore} from "./provider";
import {Blank,Button,CheckoutProgress,Cover,Go,PageHead} from "./shared";
import type {SimulationLine} from "@/lib/payments/simulation-order";
import {ArrowLeft,Landmark,ShieldCheck,Truck,WalletCards} from "lucide-react";

type Order={id:string;created_at:string;items:SimulationLine[];subtotal:number;shipping:number;total:number;channel:string;session_id:string|null;setup_error:string;status?:string;expires_at?:string;verified_at?:string};
type Result={order:Order;payment:{id:string;url:string;status:string;amount:number}|null};
const methods=[
  {value:"DANA",label:"DANA",mark:"DANA",kind:"wallet"},
  {value:"OVO",label:"OVO",mark:"OVO",kind:"wallet"},
  {value:"SHOPEEPAY",label:"ShopeePay",mark:"SP",kind:"wallet"},
  {value:"LINKAJA",label:"LinkAja",mark:"LA",kind:"wallet"},
  {value:"ASTRAPAY",label:"AstraPay",mark:"AP",kind:"wallet"},
  {value:"GOPAY",label:"GoPay",mark:"GP",kind:"wallet"},
  {value:"BNI_VIRTUAL_ACCOUNT",label:"BNI",mark:"BNI",kind:"va"},
  {value:"BRI_VIRTUAL_ACCOUNT",label:"BRI",mark:"BRI",kind:"va"},
  {value:"BCA_VIRTUAL_ACCOUNT",label:"BCA",mark:"BCA",kind:"va"},
  {value:"MANDIRI_VIRTUAL_ACCOUNT",label:"Mandiri",mark:"MDR",kind:"va"},
  {value:"PERMATA_VIRTUAL_ACCOUNT",label:"Permata",mark:"PRM",kind:"va"},
  {value:"CIMB_VIRTUAL_ACCOUNT",label:"CIMB",mark:"CIMB",kind:"va"},
  {value:"BSI_VIRTUAL_ACCOUNT",label:"BSI",mark:"BSI",kind:"va"},
] as const;
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
  const checking=useRef(false);
  async function refresh(){
    if(checking.current)return;
    checking.current=true;setBusy(true);setError("");
    try{setResult(await api<Result>(`?id=${value.order.id}`));}catch(e){setError((e as Error).message);}
    finally{checking.current=false;setBusy(false);}
  }
  useEffect(()=>{
    if(result.payment?.status!=="ACTIVE")return;
    let canceled=false,attempts=0;
    const timer=setInterval(async()=>{
      if(document.visibilityState!=="visible"||checking.current||attempts>=20)return;
      attempts++;checking.current=true;
      try{const next=await api<Result>(`?id=${value.order.id}`);if(!canceled){setResult(next);setError("");}}
      catch{if(!canceled)setError("Pemeriksaan otomatis tertunda. Anda dapat memeriksa status kembali.");}
      finally{checking.current=false;}
    },15000);
    return()=>{canceled=true;clearInterval(timer);};
  },[value.order.id,result.payment?.status]);
  return <section className="panel" style={{overflowWrap:"anywhere"}}>
    <h2>Pesanan Mode Tes</h2><p>SIM-{result.order.id}</p>
    <p role="status">{result.payment?statuses[result.payment.status]:"Sesi pembayaran belum terkonfirmasi"}</p>
    {result.order.items.map(item=><p key={item.slug}>{item.quantity} × {item.title} · {money(item.unit_price)}</p>)}
    <p>Ongkir simulasi: {money(result.order.shipping)}</p><p>Total simulasi: <strong>{money(result.order.total)}</strong></p>
    <p>Tidak masuk pesanan asli, tidak memotong stok, tidak dicatat sebagai pendapatan, dan tidak dikirim.</p>
    {result.order.expires_at&&result.payment?.status==="ACTIVE"&&<p>Batas pembayaran: {new Date(result.order.expires_at).toLocaleString("id-ID")}. Reservasi stok hanya berlaku untuk sandbox.</p>}
    {result.payment?.status==="ACTIVE"&&<p><a href={result.payment.url} target="_blank" rel="noopener noreferrer">Buka pembayaran Mode Tes Xendit ↗</a></p>}
    {!result.payment&&<p role="alert">{result.order.setup_error||"Pembuatan sesi sedang berjalan atau hasilnya belum pasti. Periksa kembali; jangan membuat pesanan ganda."}</p>}
    <Button disabled={busy} onClick={()=>void refresh()}>{busy?"Memeriksa…":"Periksa status dari Xendit"}</Button>
    {error&&<p role="alert">{error}</p>}
    <p>Status diperiksa otomatis selama halaman terbuka. Gunakan tombol pemeriksaan jika pembaruan tertunda.</p>
    {result.payment&&["EXPIRED","CANCELED"].includes(result.payment.status)&&<Go href={`/checkout?retry=${result.order.id}`} outline>Coba pembayaran baru</Go>}
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
      const retry=new URLSearchParams(window.location.search).get("retry");
      const key=previous.fingerprint===fingerprint&&previous.key&&previous.key!==retry?previous.key:crypto.randomUUID();
      localStorage.setItem(storageKey,JSON.stringify({key,fingerprint}));
      const created=await api<Result>("",{key,channel,courier,lines:state.cart,expectedTotal:total.total});
      setResult(created);
      // Preserve the attempt key until an explicit retry after expiry/cancellation.
    }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  return <div className="wrap checkout-page simulation-checkout">
    <PageHead title="Checkout — Mode Tes" description="Xendit sandbox · Tidak menerima uang sungguhan · Tanpa QRIS"/>
    <CheckoutProgress current={3}/>
    <div className="sandbox-banner"><ShieldCheck size={22}/><div><strong>Lingkungan pembayaran aman untuk pengujian</strong><p>Tidak memerlukan rekening, alamat, atau nomor HP pribadi. Gunakan simulasi resmi Xendit dan jangan transfer uang sungguhan.</p></div><span>MODE TES</span></div>
    {result?<Receipt key={result.order.id} value={result}/>:<div className="checkout-layout">
      <section className="panel simulation-payment-panel">
        <div className="checkout-section-title"><span>1</span><div><h2><WalletCards size={21}/> Pilih channel pembayaran</h2><p>Semua channel di bawah menggunakan Xendit sandbox.</p></div></div>
        <fieldset disabled={busy} className="simulation-method-fieldset">
          <legend><WalletCards size={17}/> E-wallet</legend>
          <div className="simulation-method-grid">
            {methods.filter(method=>method.kind==="wallet").map(method=><label className={`simulation-method${channel===method.value?" chosen":""}`} key={method.value}>
              <input type="radio" name="simulation-channel" value={method.value} checked={channel===method.value} onChange={e=>setChannel(e.target.value)}/>
              <span className="simulation-method-mark">{method.mark}</span><strong>{method.label}</strong><small>Mode Tes</small>
            </label>)}
          </div>
          <legend><Landmark size={17}/> Virtual account</legend>
          <div className="simulation-method-grid">
            {methods.filter(method=>method.kind==="va").map(method=><label className={`simulation-method${channel===method.value?" chosen":""}`} key={method.value}>
              <input type="radio" name="simulation-channel" value={method.value} checked={channel===method.value} onChange={e=>setChannel(e.target.value)}/>
              <span className="simulation-method-mark">{method.mark}</span><strong>VA {method.label}</strong><small>Mode Tes</small>
            </label>)}
          </div>
        </fieldset>
        <div className="checkout-form-section simulation-shipping">
          <div className="checkout-section-title"><span>2</span><div><h2><Truck size={20}/> Ongkir simulasi</h2><p>Tidak memicu pengiriman barang.</p></div></div>
          <div className="simulation-courier-grid">
            {["Reguler","Ekspres"].map(option=><label className={courier===option?"chosen":""} key={option}><input type="radio" name="simulation-courier" value={option} checked={courier===option} disabled={busy} onChange={e=>setCourier(e.target.value)}/><span><strong>{option}</strong><small>{option==="Reguler"?"Rp18.000":"Rp30.000"}</small></span></label>)}
          </div>
        </div>
      </section>
      <aside className="panel order-summary checkout-order-summary simulation-summary">
        <div className="checkout-summary-head"><div><p className="eyebrow">Mode Tes</p><h2>Ringkasan</h2></div><span>{methods.find(method=>method.value===channel)?.label}</span></div>
        <div className="checkout-summary-items">{state.cart.map(line=>{const book=books.find(item=>item.slug===line.slug);return <div className="checkout-summary-item" key={line.slug}>{book&&<Cover book={book}/>}<span><strong>{book?.title||line.slug}</strong><small>{line.qty} × buku fisik</small></span><b>{money((book?.price||0)*line.qty)}</b></div>})}</div>
        <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{money(total.subtotal)}</dd></div><div><dt>Ongkir simulasi</dt><dd>{money(total.shipping)}</dd></div><div className="grand"><dt>Total simulasi</dt><dd>{money(total.total)}</dd></div></dl>
        <label className="check-label checkout-agreement"><input type="checkbox" checked={agree} disabled={busy} onChange={e=>setAgree(e.target.checked)}/>Saya memahami ini simulasi, bukan pembelian atau pembayaran asli.</label>
        {(error||invalid||booksError)&&<p role="alert" className="form-error">{error||invalid||booksError}</p>}
        <Button className="wide checkout-primary-action" disabled={busy||!agree||!!invalid||!booksReady||!!booksError} onClick={()=>void submit()}>{busy?"Membuat simulasi…":"Lanjut ke Xendit Mode Tes"}</Button>
        <p className="checkout-assurance"><ShieldCheck size={15}/> Tidak memotong stok dan tidak tercatat sebagai pendapatan.</p>
      </aside>
    </div>}
    <div className="simulation-footer-actions"><Button variant="outline" disabled={busy} onClick={onBack}><ArrowLeft size={16}/> Kembali ke COD</Button><Go href="/pesanan-simulasi" outline>Riwayat Mode Tes</Go></div>
  </div>;
}

export function SimulationOrders(){
  const {state,accountReady}=useStore();
  if(!accountReady)return <div className="wrap"><p>Memuat akun…</p></div>;
  if(!state.session)return <div className="wrap"><Blank title="Masuk untuk melihat pembayaran" text="Riwayat Mode Tes tersimpan di akun Anda." href="/masuk?next=/pesanan-simulasi" cta="Masuk"/></div>;
  return <CustomerSimulationOrders key={state.session}/>;
}
function CustomerSimulationOrders(){
  const {state,accountReady}=useStore();
  const [orders,setOrders]=useState<Order[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<Result|null>(null);
  useEffect(()=>{if(!accountReady||!state.session)return;let canceled=false;
    api<{orders:Order[]}>().then(async data=>{if(canceled)return;setOrders(data.orders);
      const id=new URLSearchParams(window.location.search).get("id");
      if(id&&data.orders.some(order=>order.id===id)){const receipt=await api<Result>(`?id=${id}`);if(!canceled)setSelected(receipt);}
    }).catch(e=>{if(!canceled)setError(e.message);});
    return()=>{canceled=true;};
  },[accountReady,state.session]);
  return <div className="wrap"><PageHead title="Pesanan Mode Tes" description="Riwayat terpisah dari pesanan dan pendapatan asli · 50 percobaan terbaru"/>
    <p className="notice">MODE TES — tanpa uang asli atau pengiriman barang. Riwayat ini hanya menampilkan pembayaran akun Anda.</p>
    {!accountReady?<p>Memuat akun…</p>:!state.session?<Blank title="Masuk untuk melihat pembayaran" text="Riwayat Mode Tes tersimpan di akun Anda." href="/masuk?next=/pesanan-simulasi" cta="Masuk"/>:<>
      {selected&&<Receipt key={selected.order.id} value={selected}/>}
      {!orders.length&&!error&&<p>Belum ada pesanan simulasi yang dimuat.</p>}
      {orders.map(order=><section className="panel" key={order.id} style={{marginBottom:16,overflowWrap:"anywhere"}}><h2>SIM-{order.id.slice(0,8)}</h2><p>{order.channel} · {money(order.total)} · {new Date(order.created_at).toLocaleString("id-ID")}</p>
        <p>{statuses[(selected?.order.id===order.id?selected.payment?.status:order.status)||""]||"Status belum diverifikasi"}</p>
        <Button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{setSelected(await api<Result>(`?id=${order.id}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Lihat dan verifikasi simulasi</Button>
      </section>)}
      {error&&<p role="alert">{error}</p>}
    </>}
    <Go href="/checkout" outline>Kembali ke checkout</Go>
  </div>;
}
