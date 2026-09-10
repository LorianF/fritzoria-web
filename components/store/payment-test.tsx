"use client";

import { useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useStore } from "./provider";
import { Blank, Button, Go, PageHead, Shell } from "./shared";

type Session = { id: string; url: string; status: string; amount: number; channel: string };
const channels = [
  ["BCA_VIRTUAL_ACCOUNT", "VA BCA"], ["BNI_VIRTUAL_ACCOUNT", "VA BNI"],
  ["BRI_VIRTUAL_ACCOUNT", "VA BRI"], ["MANDIRI_VIRTUAL_ACCOUNT", "VA Mandiri"],
  ["PERMATA_VIRTUAL_ACCOUNT", "VA Permata"], ["CIMB_VIRTUAL_ACCOUNT", "VA CIMB"],
  ["BSI_VIRTUAL_ACCOUNT", "VA BSI"], ["DANA", "DANA"], ["OVO", "OVO"],
  ["SHOPEEPAY", "ShopeePay"], ["LINKAJA", "LinkAja"], ["ASTRAPAY", "AstraPay"], ["GOPAY", "GoPay"],
];
const statuses: Record<string, string> = { ACTIVE: "Menunggu simulasi pembayaran", COMPLETED: "Simulasi selesai — bukan pembayaran asli", EXPIRED: "Sesi simulasi kedaluwarsa", CANCELED: "Sesi simulasi dibatalkan" };

export function PaymentTest() {
  const { state, accountReady, isAdmin } = useStore();
  const [channel, setChannel] = useState("BNI_VIRTUAL_ACCOUNT");
  const [session, setSession] = useState<Session | null>(null);
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function request(create: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const auth = await getSupabaseBrowserClient().auth.getSession();
      if (!auth.data.session) throw new Error("Silakan masuk kembali.");
      const id = session?.id || lookup.trim();
      const response = await fetch(`/api/payments/test${create ? "" : `?id=${encodeURIComponent(id)}`}`, {
        method: create ? "POST" : "GET",
        headers: { Authorization: `Bearer ${auth.data.session.access_token}`, "Content-Type": "application/json" },
        body: create ? JSON.stringify({ channel }) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Simulasi belum dapat diproses.");
      setSession(result); setLookup(result.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Simulasi belum dapat diproses."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Shell><div className="wrap">
    <PageHead title="Simulasi pembayaran Xendit" description="MODE TES · Khusus admin · Tanpa QRIS" />
    {!accountReady ? <p role="status">Memuat akun…</p> : !state.session || !isAdmin ?
      <Blank title="Akses admin diperlukan" text="Halaman ini tidak menerima pembayaran pelanggan." href="/masuk?next=/uji-pembayaran" cta="Masuk sebagai admin" /> :
      <section className="panel" style={{ maxWidth: 680, marginBottom: 32 }}>
        <h2>Tidak ada uang sungguhan yang ditagihkan</h2>
        <p>Nominal uji tetap Rp10.000. Ini bukan pesanan buku: stok, keranjang, pendapatan, dan pengiriman tidak berubah. Jangan transfer uang sungguhan ke instruksi Mode Tes.</p>
        <p>Channel yang bisa digunakan bergantung pada akses akun Xendit Anda.</p>
        {!session && <>
          <label htmlFor="test-channel">Metode pembayaran simulasi</label>
          <select id="test-channel" value={channel} disabled={busy} onChange={e => setChannel(e.target.value)}>
            {channels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button disabled={busy} onClick={() => void request(true)}>{busy ? "Menghubungi Xendit…" : "Buat simulasi Rp10.000"}</Button>
          <hr />
          <label htmlFor="test-session">Periksa sesi sebelumnya (ID dari dashboard Xendit)</label>
          <input id="test-session" value={lookup} onChange={e => setLookup(e.target.value)} placeholder="ps-…" maxLength={67} disabled={busy} />
          <Button variant="outline" disabled={busy || !lookup.trim()} onClick={() => void request(false)}>Periksa sesi</Button>
        </>}
        {session && <div>
          <p role="status">{statuses[session.status]}</p>
          <p style={{ overflowWrap: "anywhere" }}>ID: {session.id}</p>
          {session.status === "ACTIVE" && <p><a href={session.url} target="_blank" rel="noopener noreferrer">Buka pembayaran Mode Tes Xendit ↗</a></p>}
          <Button disabled={busy} onClick={() => void request(false)}>{busy ? "Memeriksa…" : "Periksa status dari Xendit"}</Button>
          <p>Status diperiksa langsung dari server Xendit; kembali dari halaman pembayaran tidak otomatis berarti berhasil. Simpan ID sesi jika ingin memeriksanya setelah reload.</p>
          {session.status !== "ACTIVE" && <Button variant="outline" disabled={busy} onClick={() => { setSession(null); setLookup(""); }}>Uji metode lain</Button>}
        </div>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <p>Jika permintaan terputus, periksa sesi di dashboard Xendit sebelum membuat ulang. Tahap ini belum memakai webhook atau menyimpan riwayat simulasi di database Fritzoria.</p>
      </section>}
    <Go href="/admin" outline>Kembali ke admin</Go>
  </div></Shell>;
}
