"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "./provider";
import { Button, Blank, PageHead, Pick, Go } from "./shared";
import { AddressEditor } from "./account";
import { totals, money, cartError } from "@/lib/store/logic";
import { createOrder } from "@/lib/supabase/orders";

export function Checkout() {
  const {
    state,
    accountReady,
    books,
    booksReady,
    booksError,
    update,
    refreshBooks,
    refreshOrders,
  } = useStore();
  const [address, setAddress] = useState("");
  const [courier, setCourier] = useState("Reguler");
  const [note, setNote] = useState("");
  const [editor, setEditor] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  const lock = useRef(false);
  const router = useRouter();
  const addresses = state.addresses.filter((a) => a.email === state.session);
  const chosen =
    addresses.find((a) => a.id === address) ||
    addresses.find((a) => a.primary) ||
    addresses[0];
  const total = totals(state.cart, books, undefined, courier);
  const invalid =
    cartError(state.cart, books) ||
    (state.cart.some((l) => l.format !== "fisik")
      ? "Checkout COD hanya tersedia untuk buku fisik. Hapus e-book dari keranjang terlebih dahulu."
      : "") ||
    (state.cart.some((l) => books.find((b) => b.slug === l.slug)?.preorder)
      ? "Buku preorder belum tersedia untuk checkout COD."
      : "");
  if (!accountReady) return <p className="loading-state">Memuat akun…</p>;
  if (!state.session)
    return (
      <div className="wrap">
        <Blank
          pageTitle
          title="Masuk untuk melanjutkan"
          text="Pesanan akan tersimpan di akun Anda."
          href="/masuk?next=/checkout"
          cta="Masuk"
        />
      </div>
    );
  if (created)
    return (
      <div className="wrap">
        <PageHead
          title="Pesanan berhasil dibuat"
          description={`${created} · COD — belum dibayar`}
        />
        <p>
          Bayar saat barang diterima. Membuat pesanan tidak memotong saldo Anda.
        </p>
        <Go href={`/pesanan/${created}`}>Lihat pesanan</Go>
      </div>
    );
  if (!state.cart.length)
    return (
      <div className="wrap">
        <Blank
          pageTitle
          title="Keranjang kosong"
          text="Pilih buku sebelum membuat pesanan."
        />
      </div>
    );
  const submit = async () => {
    if (
      lock.current ||
      invalid ||
      !chosen ||
      !agree ||
      !booksReady ||
      booksError
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    const lines = state.cart.map((l) => ({ ...l }));
    try {
      // Persist retries across reloads; never create a new key after an ambiguous failure.
      const fingerprint = JSON.stringify({
        user: state.session,
        lines: [...lines].sort((a, b) => a.slug.localeCompare(b.slug)),
        address: chosen.id,
        courier,
        note,
        total: total.total,
      });
      const storageKey = `fritzoria-checkout:${state.session}`;
      let previous: { fingerprint?: string; key?: string } = {};
      try {
        previous = JSON.parse(localStorage.getItem(storageKey) || "{}");
      } catch {
        /* replace invalid device data */
      }
      const key =
        previous.fingerprint === fingerprint && previous.key
          ? previous.key
          : crypto.randomUUID();
      localStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
      const id = await createOrder({
        key,
        addressId: chosen.id,
        lines,
        courier,
        note,
        total: total.total,
      });
      setCreated(id);
      update((s) => ({
        ...s,
        cart: s.cart.flatMap((l) => {
          const purchased = lines.find(
            (x) => x.slug === l.slug && x.format === l.format,
          );
          return !purchased
            ? [l]
            : l.qty > purchased.qty
              ? [{ ...l, qty: l.qty - purchased.qty }]
              : [];
        }),
      }));
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* committed order remains valid */
      }
      await Promise.all([refreshOrders(), refreshBooks()]);
      toast.success("Pesanan tersimpan. Pembayaran COD belum diterima.");
      router.push(`/pesanan/${id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Pesanan belum dapat dikonfirmasi. Coba lagi.",
      );
      await refreshBooks();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="wrap">
      <PageHead
        title="Checkout"
        description="Buku fisik · Bayar di tempat (COD)"
      />
      <div className="checkout-layout">
        <div className="panel">
          <fieldset disabled={busy}>
            <h2>Alamat pengiriman</h2>
            <Pick
              label="Pilih alamat"
              value={chosen?.id || ""}
              onChange={setAddress}
              options={addresses.map((a) => [a.id, `${a.label} — ${a.name}`])}
            />
            {chosen && (
              <p>
                {chosen.name} · {chosen.phone}
                <br />
                {chosen.street}, {chosen.city}, {chosen.province}{" "}
                {chosen.postal}
              </p>
            )}
            <Button variant="outline" onClick={() => setEditor(true)}>
              Tambah alamat
            </Button>
            <h2>Pengiriman</h2>
            <Pick
              label="Metode pengiriman"
              value={courier}
              onChange={setCourier}
              options={[
                ["Reguler", "Reguler — Rp18.000"],
                ["Ekspres", "Ekspres — Rp30.000"],
              ]}
            />
            <p className="muted">
              Gratis ongkir mulai Rp250.000. Pengiriman dikelola toko; belum
              terhubung otomatis ke kurir.
            </p>
            <h2>Pembayaran COD</h2>
            <p>
              Bayar saat barang diterima. Tidak ada pembayaran online pada tahap
              ini.
            </p>
            <label>
              Catatan (opsional)
              <textarea
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </fieldset>
        </div>
        <aside className="panel order-summary">
          <h2>Ringkasan pesanan</h2>
          {state.cart.map((l) => (
            <p key={`${l.slug}-${l.format}`}>
              {l.qty} × {books.find((b) => b.slug === l.slug)?.title || l.slug}
            </p>
          ))}
          <p>Subtotal: {money(total.subtotal)}</p>
          <p>Ongkir: {money(total.shipping)}</p>
          <strong>Total: {money(total.total)}</strong>
          <p className="muted">Voucher belum tersedia untuk checkout COD.</p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={agree}
              disabled={busy}
              onChange={(e) => setAgree(e.target.checked)}
            />
            Saya telah memeriksa alamat dan total, serta memilih bayar saat
            barang diterima.
          </label>
          {(error || invalid || booksError) && (
            <p role="alert" className="form-error">
              {error || invalid || booksError}
            </p>
          )}
          <Button
            disabled={
              busy ||
              !agree ||
              !chosen ||
              !!invalid ||
              !booksReady ||
              !!booksError
            }
            onClick={() => void submit()}
          >
            {busy ? "Menyimpan pesanan…" : "Buat pesanan COD"}
          </Button>
          <Go href="/keranjang" outline>
            Kembali ke keranjang
          </Go>
        </aside>
      </div>
      <AddressEditor open={editor} onClose={() => setEditor(false)} />
    </div>
  );
}
