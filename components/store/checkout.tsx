"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "./provider";
import {
  Button,
  Blank,
  CheckoutProgress,
  Cover,
  PageHead,
  Pick,
  Go,
} from "./shared";
import { AddressEditor } from "./account";
import { totals, money, cartError } from "@/lib/store/logic";
import { createOrder } from "@/lib/supabase/orders";
import { SimulationCheckout } from "./simulation-checkout";
import {
  Banknote,
  Check,
  CreditCard,
  MapPin,
  ShieldCheck,
  Truck,
} from "lucide-react";

export function Checkout({testEnabled=false}:{testEnabled?:boolean}) {
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
  const [testMode, setTestMode] = useState(false);
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
          text="Pilih buku fisik terlebih dahulu. Di checkout tersedia COD untuk pesanan asli serta 13 virtual account/e-wallet Xendit Mode Tes tanpa uang sungguhan."
        />
        {testEnabled && (
          <p className="notice">
            Metode online Mode Tes muncul setelah ada buku fisik di keranjang:
            DANA, OVO, ShopeePay, LinkAja, AstraPay, GoPay, serta VA BNI,
            BRI, BCA, Mandiri, Permata, CIMB, dan BSI.
          </p>
        )}
      </div>
    );
  if (testEnabled && testMode) return <SimulationCheckout onBack={()=>setTestMode(false)}/>;
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
    <div className="wrap checkout-page">
      <PageHead
        title="Checkout"
        description={testEnabled ? "Buku fisik · COD atau pembayaran online Mode Tes" : "Buku fisik · Bayar di tempat (COD)"}
      />
      <CheckoutProgress current={2} />
      {testEnabled && (
        <section className="checkout-methods" aria-labelledby="payment-method-title">
          <div className="checkout-methods-copy">
            <p className="eyebrow">Pilih jalur pembayaran</p>
            <h2 id="payment-method-title">Bagaimana Anda ingin melanjutkan?</h2>
            <p>
              COD membuat pesanan asli. Xendit Mode Tes hanya menguji alur
              pembayaran tanpa uang sungguhan.
            </p>
          </div>
          <div className="checkout-method-grid">
            <button
              type="button"
              className="checkout-method-card chosen"
              aria-pressed="true"
            >
              <span className="checkout-method-icon"><Banknote size={22} /></span>
              <span>
                <strong>Bayar di tempat</strong>
                <small>Pesanan asli · dibayar saat buku diterima</small>
              </span>
              <Check className="checkout-method-check" size={18} />
            </button>
            <button
              type="button"
              className="checkout-method-card test"
              aria-pressed="false"
              onClick={() => setTestMode(true)}
            >
              <span className="checkout-method-icon"><CreditCard size={22} /></span>
              <span>
                <strong>Xendit Mode Tes</strong>
                <small>13 VA & e-wallet · tanpa uang sungguhan</small>
              </span>
              <span className="test-flag">MODE TES</span>
            </button>
          </div>
          <div className="checkout-method-foot">
            <span><ShieldCheck size={16} /> Data tes tidak mengubah pesanan asli atau stok.</span>
            <Go href="/pesanan-simulasi" outline>Riwayat Mode Tes</Go>
          </div>
        </section>
      )}
      <div className="checkout-layout">
        <div className="panel checkout-form-panel">
          <fieldset disabled={busy}>
            <section className="checkout-form-section">
            <div className="checkout-section-title">
              <span>1</span>
              <div><h2><MapPin size={20} /> Alamat pengiriman</h2><p>Pastikan penerima dan alamat sudah benar.</p></div>
            </div>
            <Pick
              label="Pilih alamat"
              value={chosen?.id || ""}
              onChange={setAddress}
              options={addresses.map((a) => [a.id, `${a.label} — ${a.name}`])}
            />
            {chosen && (
              <p className="checkout-address-preview">
                {chosen.name} · {chosen.phone}
                <br />
                {chosen.street}, {chosen.city}, {chosen.province}{" "}
                {chosen.postal}
              </p>
            )}
            <Button variant="outline" onClick={() => setEditor(true)}>
              Tambah alamat
            </Button>
            </section>
            <section className="checkout-form-section">
            <div className="checkout-section-title">
              <span>2</span>
              <div><h2><Truck size={20} /> Pengiriman</h2><p>Pilih kecepatan pengiriman buku.</p></div>
            </div>
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
            </section>
            <section className="checkout-form-section">
            <div className="checkout-section-title">
              <span>3</span>
              <div><h2><Banknote size={20} /> Catatan pesanan</h2><p>COD dipilih. Pembayaran dilakukan saat buku diterima.</p></div>
            </div>
            <label>
              Catatan (opsional)
              <textarea
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            </section>
          </fieldset>
        </div>
        <aside className="panel order-summary checkout-order-summary">
          <div className="checkout-summary-head">
            <div><p className="eyebrow">Pesanan Anda</p><h2>Ringkasan</h2></div>
            <span>{state.cart.reduce((sum, line) => sum + line.qty, 0)} buku</span>
          </div>
          <div className="checkout-summary-items">
            {state.cart.map((line) => {
              const book = books.find((item) => item.slug === line.slug);
              return (
                <div className="checkout-summary-item" key={`${line.slug}-${line.format}`}>
                  {book && <Cover book={book} />}
                  <span><strong>{book?.title || line.slug}</strong><small>{line.qty} × {line.format}</small></span>
                  <b>{money((book?.price || 0) * line.qty)}</b>
                </div>
              );
            })}
          </div>
          <dl className="checkout-totals">
            <div><dt>Subtotal</dt><dd>{money(total.subtotal)}</dd></div>
            <div><dt>Pengiriman</dt><dd>{money(total.shipping)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{money(total.total)}</dd></div>
          </dl>
          <label className="check-label checkout-agreement">
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
            className="wide checkout-primary-action"
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
          <Go href="/keranjang" outline className="wide">
            Kembali ke keranjang
          </Go>
          <p className="checkout-assurance"><ShieldCheck size={15} /> Pesanan baru dibuat setelah tombol konfirmasi ditekan.</p>
        </aside>
      </div>
      <AddressEditor open={editor} onClose={() => setEditor(false)} />
    </div>
  );
}
