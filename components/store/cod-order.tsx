"use client";
import { useState } from "react";
import type { Order } from "@/lib/store/types";
import { money } from "@/lib/store/logic";
import { useStore } from "./provider";
import { Button, Go, PageHead } from "./shared";
import { Confirm } from "./account";

export function CodOrder({ order: o }: { order: Order }) {
  const { transition } = useStore();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const change = async (status: Order["status"]) => {
    setBusy(true);
    try { if (await transition(o.id, status, reason)) setReason(""); }
    finally { setBusy(false); }
  };
  return <div className="wrap">
    <PageHead title={o.id} description="Pesanan tersimpan · Bayar di tempat (COD)" />
    <section className="panel">
      <h2>Status: {o.status}</h2>
      <p>{["Selesai", "Retur diajukan", "Dikembalikan"].includes(o.status)
        ? "Penerimaan dan pembayaran COD telah dikonfirmasi. Pengembalian dana, jika disetujui, ditangani toko secara terpisah."
        : o.status === "Dibatalkan" ? "Pesanan dibatalkan; stok telah dikembalikan." : "Belum dibayar. Bayar saat barang diterima."}</p>
      {o.lines.map(l => <p key={`${l.slug}-${l.format}`}>{l.qty} × {l.title} — {money(l.price * l.qty)}</p>)}
      <p>Subtotal: {money(o.subtotal)} · Ongkir: {money(o.shipping)}</p>
      <p><strong>Total: {money(o.total)}</strong></p>
      <p>{o.address?.name} · {o.address?.phone}</p>
      <p>{o.address?.street}, {o.address?.city}, {o.address?.province} {o.address?.postal}</p>
      <p>Pengiriman: {o.courier}</p>
      {o.note && <p>Catatan: {o.note}</p>}
      {o.returnReason && <p>Alasan retur: {o.returnReason}</p>}
      <div className="button-row">
        {o.status === "Menunggu pembayaran" && <Confirm title="Batalkan pesanan?" text="Stok buku akan dikembalikan. Pesanan yang sudah diproses hanya dapat dibatalkan oleh toko." action={() => { void change("Dibatalkan"); }}><Button disabled={busy} variant="outline">Batalkan pesanan</Button></Confirm>}
        {o.status === "Dikirim" && <Confirm title="Buku diterima dan COD sudah dibayar?" text="Konfirmasi hanya setelah menerima buku dan membayar jumlah tagihan." action={() => { void change("Selesai"); }}><Button disabled={busy}>Konfirmasi diterima & dibayar</Button></Confirm>}
        <Go href="/pesanan" outline>Daftar pesanan</Go>
      </div>
    </section>
    {o.status === "Selesai" && <form className="panel form-stack" onSubmit={e => { e.preventDefault(); void change("Retur diajukan"); }}>
      <h2>Ajukan retur seluruh pesanan</h2>
      <label>Alasan retur<textarea required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <Button disabled={busy || reason.trim().length < 10} type="submit">Ajukan retur</Button>
    </form>}
    <section className="panel"><h2>Perjalanan pesanan</h2><ol className="timeline">{o.history.map((h, i) => <li key={i}><span /><div><strong>{h.status}</strong><small>{new Date(h.date).toLocaleString("id-ID")}</small></div></li>)}</ol></section>
  </div>;
}
