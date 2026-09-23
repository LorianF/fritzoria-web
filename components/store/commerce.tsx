"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  MapPin,
  Minus,
  Plus,
  Trash2,
  Printer,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "./provider";
import {
  Button,
  Input,
  Go,
  PageHead,
  Blank,
  Crumbs,
  Cover,
  Pick,
} from "./shared";
import { Confirm } from "./account";
import { CodOrder } from "./cod-order";
import { money, unit, totals, cartError } from "@/lib/store/logic";
function Sum({
  subtotal,
  discount,
  shipping,
  total,
}: {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}) {
  return (
    <dl className="order-sum">
      <div>
        <dt>Subtotal buku</dt>
        <dd>{money(subtotal)}</dd>
      </div>
      <div>
        <dt>Potongan voucher</dt>
        <dd>−{money(discount)}</dd>
      </div>
      <div>
        <dt>Pengiriman</dt>
        <dd>{shipping ? money(shipping) : "Gratis"}</dd>
      </div>
      <div className="grand">
        <dt>Total</dt>
        <dd>{money(total)}</dd>
      </div>
    </dl>
  );
}
export function Cart() {
  const { state, books, update, booksReady, booksError, refreshBooks } = useStore();
  if (!booksReady) return <div className="wrap loading-state"><h1>Keranjang belanja</h1><p>Memuat katalog…</p></div>;
  if (booksError) return <div className="wrap"><h1>Keranjang belanja</h1><p role="alert">{booksError}</p><Button onClick={() => void refreshBooks()}>Coba lagi</Button></div>;
  const t = totals(state.cart, books, undefined, "Reguler");
  const error = cartError(state.cart, books);
  if (!state.cart.length)
    return (
      <div className="wrap">
        <Crumbs items={[["Keranjang", ""]]} />
        <Blank
          title="Keranjangmu masih kosong"
          text="Ada banyak cerita menunggu. Pilih buku yang ingin kamu bawa pulang."
          pageTitle
        />
      </div>
    );
  return (
    <div className="wrap">
      <Crumbs items={[["Keranjang", ""]]} />
      <PageHead
        title="Keranjang belanja"
        eyebrow="LANGKAH PERTAMA"
        description={`${state.cart.reduce((n, l) => n + l.qty, 0)} buku pilihanmu`}
      />
      <div className="checkout-layout">
        <div>
          <div className="cart-list">
            {state.cart.map((l) => {
              const b = books.find((b) => b.slug === l.slug);
              return (
                <article className="cart-row" key={`${l.slug}-${l.format}`}>
                  {b && (
                    <Link href={`/buku/${b.slug}`}>
                      <Cover book={b} />
                    </Link>
                  )}
                  <div>
                    <Link href={`/buku/${l.slug}`} className="cart-title">
                      {b?.title || "Buku tidak tersedia"}
                    </Link>
                    <p className="muted">{b?.author}</p>
                    <span className="small-tag">
                      {l.format === "fisik" ? "Buku fisik" : "E-book"}
                    </span>
                    <div className="cart-controls">
                      {l.format === "fisik" && (
                        <div className="quantity">
                          <button
                            aria-label={`Kurangi ${b?.title}`}
                            disabled={l.qty <= 1}
                            onClick={() =>
                              update((s) => ({
                                ...s,
                                cart: s.cart.map((x) =>
                                  x.slug === l.slug && x.format === l.format
                                    ? { ...x, qty: Math.max(1, x.qty - 1) }
                                    : x,
                                ),
                              }))
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <span>{l.qty}</span>
                          <button
                            aria-label={`Tambah ${b?.title}`}
                            disabled={!b || l.qty >= b.stock}
                            onClick={() =>
                              update((s) => ({
                                ...s,
                                cart: s.cart.map((x) =>
                                  x.slug === l.slug && x.format === l.format
                                    ? {
                                        ...x,
                                        qty: Math.min(b?.stock || 0, x.qty + 1),
                                      }
                                    : x,
                                ),
                              }))
                            }
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                      <button
                        className="text-link"
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            cart: s.cart.filter(
                              (x) =>
                                !(x.slug === l.slug && x.format === l.format),
                            ),
                          }))
                        }
                      >
                        <Trash2 size={15} /> Hapus
                      </button>
                    </div>
                  </div>
                  <strong>{money(b ? unit(b, l.format) * l.qty : 0)}</strong>
                </article>
              );
            })}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Link href="/katalog" className="text-link">
            <ArrowLeft size={16} /> Lanjut belanja
          </Link>
        </div>
        <aside className="panel order-summary">
          <h2>Ringkasan belanja</h2>
          <Sum {...t} />
          <p className="muted small">
            Estimasi ongkir reguler. Checkout COD belum mendukung voucher.
          </p>
          {error ? (
            <Button disabled className="wide">
              Periksa keranjang
            </Button>
          ) : (
            <Go className="wide" href="/checkout">
              Lanjut checkout <ArrowRight size={16} />
            </Go>
          )}
          <p className="notice">
            Pesanan COD disimpan ke akun Anda. Pembayaran dilakukan saat barang
            diterima; pengiriman dikelola toko.
          </p>
        </aside>
      </div>
    </div>
  );
}
export { Checkout } from "./checkout";
export function Orders() {
  const { state, ordersReady, ordersError, refreshOrders } = useStore();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  if (state.session && !ordersReady)
    return <div className="loading-state" role="status"><h1>Pesanan saya</h1><p>Memuat pesanan…</p></div>;
  if (state.session && ordersError)
    return (
      <div className="wrap">
        <p role="alert">{ordersError}</p>
        <Button onClick={() => void refreshOrders()}>Muat ulang</Button>
      </div>
    );
  if (!state.session)
    return (
      <div className="wrap">
        <Blank
          pageTitle
          title="Masuk untuk melihat pesanan"
          text="Pesanan tersimpan di akun Anda dan dapat dilihat dari perangkat lain."
          href="/masuk?next=/pesanan"
          cta="Masuk"
        />
      </div>
    );
  const list = state.orders.filter(
    (o) =>
      o.email === state.session &&
      (status === "all" || o.status === status) &&
      `${o.id} ${o.lines.map((l) => l.title).join(" ")}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div className="wrap">
      <Crumbs
        items={[
          ["Akun", "/akun"],
          ["Pesanan", ""],
        ]}
      />
      <PageHead title="Pesanan saya" eyebrow="DARI RAK KE RUMAH" />
      <p className="notice">Pembayaran online yang diuji tersimpan terpisah. <Go href="/pesanan-simulasi" outline>Lihat pembayaran Mode Tes</Go></p>
      <div className="order-filters">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cari pesanan"
          placeholder="Nomor pesanan atau judul buku"
        />
        <Pick
          value={status}
          onChange={setStatus}
          label="Status pesanan"
          options={[
            "all",
            "Menunggu pembayaran",
            "Pembayaran gagal",
            "Diproses",
            "Dikirim",
            "Selesai",
            "Dibatalkan",
            "Retur diajukan",
            "Dikembalikan",
          ].map((s) => [s, s === "all" ? "Semua status" : s])}
        />
      </div>
      {list.length ? (
        list.map((o) => (
          <div className="order-card" key={o.id}>
            <div className="order-card-head">
              <span>
                {o.id}{" "}
                <small>{new Date(o.date).toLocaleDateString("id-ID")}</small>
              </span>
              <span className="status">{o.status}</span>
            </div>
            <div className="order-card-body">
              <Cover book={o.lines[0]} />
              <div>
                <Link href={`/pesanan/${o.id}`} className="cart-title">
                  {o.lines[0].title}
                </Link>
                <p className="muted">
                  {o.lines.reduce((n, l) => n + l.qty, 0)} buku · {o.courier}
                </p>
              </div>
              <strong>{money(o.total)}</strong>
              <Go href={`/pesanan/${o.id}`} outline>
                Lihat detail <ArrowRight size={16} />
              </Go>
            </div>
          </div>
        ))
      ) : (
        <Blank
          title="Belum ada pesanan yang cocok"
          text="Setelah checkout, pesanan beserta statusnya akan tampil di sini."
        />
      )}
    </div>
  );
}
export function OrderDetail({
  id,
  payment = false,
  invoice = false,
}: {
  id: string;
  payment?: boolean;
  invoice?: boolean;
}) {
  const { state, transition, update, ordersReady, ordersError, refreshOrders } =
    useStore();
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");
  const o = state.orders.find((o) => o.id === id && o.email === state.session);
  if (state.session && !ordersReady)
    return <p className="loading-state">Memuat pesanan…</p>;
  if (state.session && ordersError)
    return (
      <div className="wrap">
        <p role="alert">{ordersError}</p>
        <Button onClick={() => void refreshOrders()}>Muat ulang</Button>
      </div>
    );
  if (o?.method === "COD") return <CodOrder order={o} />;
  if (!state.session)
    return (
      <div className="wrap">
        <Blank
          pageTitle
          title="Masuk untuk melihat pesanan"
          text="Gunakan akun yang membuat pesanan ini."
          href={`/masuk?next=/pesanan/${id}`}
          cta="Masuk"
        />
      </div>
    );
  if (!o)
    return (
      <div className="wrap">
        <Blank
          pageTitle
          title="Pesanan tidak ditemukan"
          text="Periksa nomor pesanan atau akun yang sedang digunakan."
          href="/pesanan"
          cta="Daftar pesanan"
        />
      </div>
    );
  return (
    <div className={`wrap ${invoice ? "invoice-page" : ""}`}>
      <Crumbs
        items={[
          ["Pesanan", "/pesanan"],
          [o.id, ""],
        ]}
      />
      <PageHead
        title={
          invoice
            ? "Invoice demo"
            : payment
              ? "Pembayaran pesanan"
              : "Detail pesanan"
        }
        eyebrow={o.id}
        description={new Date(o.date).toLocaleString("id-ID")}
      >
        {invoice ? (
          <Button onClick={() => window.print()}>
            <Printer size={16} /> Cetak invoice
          </Button>
        ) : (
          <Go href={`/invoice/${o.id}`} outline>
            <Printer size={16} /> Invoice
          </Go>
        )}
      </PageHead>
      {invoice && (
        <p className="notice">
          Dokumen simulasi Fritzoria. Bukan bukti pembayaran nyata atau faktur
          pajak.
        </p>
      )}
      <div className="checkout-layout">
        <div>
          {["Menunggu pembayaran", "Pembayaran gagal"].includes(o.status) && (
            <div className="payment-box">
              <h2>
                {o.status === "Pembayaran gagal"
                  ? "Simulasi pembayaran gagal"
                  : "Satu langkah lagi."}
              </h2>
              <p>
                {o.method} · Total {money(o.total)}
              </p>
              <p>
                Pilih hasil pembayaran untuk mencoba alur toko. Tidak ada uang
                yang ditagihkan.
              </p>
              <div className="button-row">
                {o.status === "Menunggu pembayaran" ? (
                  <>
                    <Button
                      onClick={() =>
                        transition(
                          id,
                          o.lines.some((l) => l.format === "fisik")
                            ? "Diproses"
                            : "Selesai",
                        )
                      }
                    >
                      <Check size={17} /> Simulasikan berhasil
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => transition(id, "Pembayaran gagal")}
                    >
                      Simulasikan gagal
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => transition(id, "Menunggu pembayaran")}>
                    Coba pembayaran lagi
                  </Button>
                )}
                <Confirm
                  title="Batalkan pesanan?"
                  text="Stok fisik yang dicadangkan akan dikembalikan."
                  action={() => transition(id, "Dibatalkan")}
                >
                  <Button variant="ghost">Batalkan</Button>
                </Confirm>
              </div>
            </div>
          )}
          <section className="panel">
            <div className="section-head">
              <h2>Buku dalam pesanan</h2>
              <span className="status">{o.status}</span>
            </div>
            <div className="mini-lines">
              {o.lines.map((l) => (
                <div key={`${l.slug}-${l.format}`}>
                  <Link href={`/buku/${l.slug}`}>
                    <Cover book={l} />
                  </Link>
                  <span>
                    <Link href={`/buku/${l.slug}`}>
                      <strong>{l.title}</strong>
                    </Link>
                    <small>
                      {l.qty} × {l.format} · {money(l.price)}
                    </small>
                  </span>
                  <b>{money(l.qty * l.price)}</b>
                </div>
              ))}
            </div>
            {o.note && <p className="muted">Catatan: {o.note}</p>}
          </section>
          {o.address && (
            <section className="panel">
              <h2>
                <MapPin size={20} /> Alamat pengiriman
              </h2>
              <p>
                <strong>{o.address.name}</strong> · {o.address.phone}
              </p>
              <p>
                {o.address.street}, {o.address.city}, {o.address.province},{" "}
                {o.address.postal}
              </p>
              <p className="muted">{o.courier} · pelacakan simulasi</p>
            </section>
          )}
          {o.lines.some((l) => l.format === "ebook") &&
            ![
              "Menunggu pembayaran",
              "Pembayaran gagal",
              "Dibatalkan",
              "Dikembalikan",
            ].includes(o.status) && (
              <section className="panel">
                <h2>
                  <BookOpen size={20} /> Buku digital tersedia
                </h2>
                <p>Buka rak digital untuk melihat koleksi dari pesanan ini.</p>
                <Go href="/rak-digital">Ke rak digital</Go>
              </section>
            )}
          <section className="panel">
            <h2>Perjalanan pesanan</h2>
            <ol className="timeline">
              {o.history.map((h, i) => (
                <li key={i}>
                  <span />
                  <div>
                    <strong>{h.status}</strong>
                    <small>{new Date(h.date).toLocaleString("id-ID")}</small>
                  </div>
                </li>
              ))}
            </ol>
            {o.returnReason && (
              <p className="notice">Alasan retur: {o.returnReason}</p>
            )}
            {o.status === "Dikirim" && (
              <Confirm
                title="Konfirmasi pesanan diterima?"
                text="Pesanan demo akan ditandai selesai."
                action={() => transition(id, "Selesai")}
              >
                <Button>Konfirmasi diterima</Button>
              </Confirm>
            )}
            {o.status === "Selesai" &&
              o.lines.some((l) => l.format === "fisik") && (
                <Button variant="outline" onClick={() => setReturnOpen(true)}>
                  Ajukan pengembalian
                </Button>
              )}
            {o.status === "Diproses" && (
              <p className="muted">
                Status pengiriman dapat dilanjutkan melalui{" "}
                <Link href="/admin/pesanan" className="text-link">
                  admin demo
                </Link>
                .
              </p>
            )}
          </section>
        </div>
        <aside className="panel order-summary">
          <h2>Ringkasan pembayaran</h2>
          <Sum {...o} />
          <p>{o.method} · simulasi</p>
          {o.voucher && <p className="muted">Voucher: {o.voucher}</p>}
          <Link href="/kontak" className="text-link">
            Butuh bantuan?
          </Link>
        </aside>
      </div>
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan pengembalian</DialogTitle>
            <DialogDescription>
              Permintaan demo diteruskan ke daftar pesanan admin lokal.
              Persetujuan retur mengembalikan seluruh nilai pesanan dan mencabut
              akses e-book dalam pesanan yang sama.
            </DialogDescription>
          </DialogHeader>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length < 10) return;
              update((s) => ({
                ...s,
                orders: s.orders.map((x) =>
                  x.id === id ? { ...x, returnReason: reason.trim() } : x,
                ),
              }));
              transition(id, "Retur diajukan");
              setReturnOpen(false);
            }}
          >
            <label>
              Alasan pengembalian
              <textarea
                required
                minLength={10}
                maxLength={600}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan kondisi buku atau masalah pesanan"
              />
            </label>
            <Button type="submit">Kirim pengajuan</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
