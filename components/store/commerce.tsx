"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ShoppingBag,
  ArrowRight,
  Check,
  MapPin,
  Truck,
  Package,
  Minus,
  Plus,
  Trash2,
  Ticket,
  Printer,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AddressEditor, Confirm } from "./account";
import { money, unit, totals, cartError } from "@/lib/store/logic";
import type { Order } from "@/lib/store/types";
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
  const { state, books, update } = useStore();
  const t = totals(state.cart, books, undefined, "Reguler");
  const error = cartError(state.cart, books);
  if (!state.cart.length)
    return (
      <div className="wrap">
        <Crumbs items={[["Keranjang", ""]]} />
        <Blank
          title="Keranjangmu masih kosong"
          text="Ada banyak cerita menunggu. Pilih buku yang ingin kamu bawa pulang."
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
            Estimasi ongkir reguler. Voucher diterapkan saat checkout.
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
            Checkout demo tidak memindahkan uang dan tidak membuat pengiriman
            nyata.
          </p>
        </aside>
      </div>
    </div>
  );
}
export function Checkout() {
  const { state, books, place } = useStore();
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [editor, setEditor] = useState(false);
  const [courier, setCourier] = useState("Reguler");
  const [method, setMethod] = useState("Virtual account");
  const [code, setCode] = useState("");
  const [voucher, setVoucher] = useState("");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState(1);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const profile = state.profiles.find((p) => p.email === state.session);
  if (!profile)
    return (
      <div className="wrap">
        <Blank
          title="Masuk untuk melanjutkan"
          text="Pesanan dan e-book akan disimpan ke akun demo di perangkat ini."
          href="/masuk?next=/checkout"
          cta="Masuk & lanjutkan"
        />
      </div>
    );
  if (!state.cart.length)
    return (
      <div className="wrap">
        <Blank
          title="Belum ada buku untuk dipesan"
          text="Tambahkan buku ke keranjang terlebih dahulu."
        />
      </div>
    );
  const addresses = state.addresses.filter((a) => a.email === profile.email);
  const chosen =
    addresses.find((a) => a.id === address) ||
    addresses.find((a) => a.primary) ||
    addresses[0];
  const v = state.vouchers.find((v) => v.code === voucher);
  const t = totals(state.cart, books, v, courier);
  const error = cartError(state.cart, books);
  const submit = () => {
    if (lock.current) return;
    if (error) {
      toast.error(error);
      return;
    }
    if (t.physical && !chosen) {
      toast.error("Tambahkan alamat pengiriman.");
      return;
    }
    if (!agree) {
      toast.error("Konfirmasi bahwa ini transaksi simulasi.");
      return;
    }
    lock.current = true;
    setBusy(true);
    const id = place({
      addressId: chosen?.id || "",
      courier,
      method,
      voucher,
      note,
    });
    if (id) router.push(`/pembayaran/${id}`);
    else {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="wrap">
      <Crumbs
        items={[
          ["Keranjang", "/keranjang"],
          ["Checkout", ""],
        ]}
      />
      <PageHead title="Selesaikan pesananmu" eyebrow="CHECKOUT" />
      <div className="steps">
        <span className="complete">1. Keranjang</span>
        <span className="current">2. Pengiriman & ringkasan</span>
        <span>3. Pembayaran demo</span>
      </div>
      <div className="checkout-layout">
        <div>
          {step === 1 ? (
            <>
              <section className="panel">
                <div className="section-head">
                  <h2>
                    <MapPin size={21} />{" "}
                    {t.physical ? "Alamat pengiriman" : "Akses digital"}
                  </h2>
                  {t.physical && (
                    <Button variant="outline" onClick={() => setEditor(true)}>
                      <Plus size={16} /> Alamat
                    </Button>
                  )}
                </div>
                {t.physical ? (
                  addresses.length ? (
                    <RadioGroup value={chosen?.id} onValueChange={setAddress}>
                      {addresses.map((a) => (
                        <label
                          className={`address-option ${chosen?.id === a.id ? "chosen" : ""}`}
                          key={a.id}
                        >
                          <RadioGroupItem value={a.id} />
                          <span>
                            <strong>
                              {a.label} · {a.name}
                            </strong>
                            <small>
                              {a.phone}
                              <br />
                              {a.street}, {a.city}, {a.province} {a.postal}
                            </small>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <p className="muted">
                      Tambahkan alamat contoh untuk melanjutkan.
                    </p>
                  )
                ) : (
                  <p>
                    E-book masuk ke rak digital <strong>{profile.email}</strong>{" "}
                    setelah pembayaran demo berhasil. Tidak memerlukan alamat
                    atau kurir.
                  </p>
                )}
              </section>
              {t.physical && (
                <section className="panel">
                  <h2>
                    <Truck size={21} /> Metode pengiriman
                  </h2>
                  <RadioGroup value={courier} onValueChange={setCourier}>
                    {[
                      ["Reguler", "2–5 hari kerja", "Rp18.000"],
                      ["Ekspres", "1–2 hari kerja", "Rp30.000"],
                    ].map(([value, desc, price]) => (
                      <label className="shipping-option" key={value}>
                        <RadioGroupItem value={value} />
                        <span>
                          <strong>{value}</strong>
                          <small>{desc} · simulasi</small>
                        </span>
                        <strong>
                          {t.subtotal - t.discount >= 250000 ? "Gratis" : price}
                        </strong>
                      </label>
                    ))}
                  </RadioGroup>
                  <p className="muted small">
                    Gratis ongkir mulai Rp250.000 setelah potongan voucher.
                  </p>
                </section>
              )}
              <section className="panel">
                <h2>Metode pembayaran</h2>
                <RadioGroup
                  value={method}
                  onValueChange={setMethod}
                  className="payment-options"
                >
                  {["Virtual account", "QRIS", "E-wallet"].map((m) => (
                    <label key={m} className={method === m ? "chosen" : ""}>
                      <RadioGroupItem value={m} />
                      {m}
                    </label>
                  ))}
                </RadioGroup>
                <p className="notice">
                  Tidak ada nomor rekening atau QR pembayaran nyata. Hasil
                  pembayaran dipilih pada langkah demo berikutnya.
                </p>
                <label>
                  Catatan pesanan
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    placeholder="Opsional, misalnya instruksi pengemasan"
                  />
                </label>
              </section>
              <Button
                onClick={() => {
                  if (t.physical && !chosen) {
                    toast.error("Tambahkan alamat pengiriman.");
                    return;
                  }
                  setStep(2);
                  window.scrollTo(0, 0);
                }}
              >
                Periksa pesanan <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <section className="panel">
                <h2>Periksa sebelum memesan</h2>
                <p>
                  <strong>Pembeli:</strong> {profile.name} · {profile.email}
                </p>
                {t.physical && (
                  <p>
                    <strong>Tujuan:</strong> {chosen?.street}, {chosen?.city} ·{" "}
                    {courier}
                  </p>
                )}
                <p>
                  <strong>Pembayaran:</strong> {method} · simulasi
                </p>
                <div className="mini-lines">
                  {state.cart.map((l) => {
                    const b = books.find((b) => b.slug === l.slug)!;
                    return (
                      <div key={`${l.slug}-${l.format}`}>
                        <Cover book={b} />
                        <span>
                          <strong>{b.title}</strong>
                          <small>
                            {l.qty} × {l.format} · {money(unit(b, l.format))}
                          </small>
                        </span>
                        <b>{money(unit(b, l.format) * l.qty)}</b>
                      </div>
                    );
                  })}
                </div>
                <label className="check-label">
                  <Checkbox
                    checked={agree}
                    onCheckedChange={(v) => setAgree(v === true)}
                  />{" "}
                  Saya memahami ini simulasi transaksi, tanpa pembayaran atau
                  pengiriman nyata.
                </label>
              </section>
              <div className="button-row">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Ubah pengiriman
                </Button>
                <Button disabled={busy || !agree || !!error} onClick={submit}>
                  {busy ? "Membuat pesanan…" : "Buat pesanan demo"}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </>
          )}
        </div>
        <aside className="panel order-summary">
          <h2>Ringkasan pesanan</h2>
          <div className="voucher-field">
            <label htmlFor="voucher">
              <Ticket size={16} /> Punya kode voucher?
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const found = state.vouchers.find(
                  (v) => v.code === code.trim().toUpperCase() && v.active,
                );
                if (!found) {
                  toast.error("Kode voucher tidak valid atau nonaktif.");
                  setVoucher("");
                  return;
                }
                if (t.subtotal < found.min) {
                  toast.error(`Minimum belanja ${money(found.min)}.`);
                  setVoucher("");
                  return;
                }
                setVoucher(found.code);
                toast.success("Voucher diterapkan.");
              }}
            >
              <Input
                id="voucher"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Contoh: BACA10"
              />
              <Button type="submit" variant="outline">
                Pakai
              </Button>
            </form>
            {voucher && (
              <p className="text-link">
                {voucher} {t.discount ? "aktif" : "belum memenuhi syarat"}{" "}
                <button
                  onClick={() => {
                    setVoucher("");
                    setCode("");
                  }}
                >
                  Hapus
                </button>
              </p>
            )}
            <Link href="/promo" target="_blank" className="text-link">
              Lihat syarat voucher ↗
            </Link>
          </div>
          <Sum {...t} />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="muted small">
            Harga dikunci ketika pesanan dibuat. Stok fisik dicadangkan hingga
            pembayaran atau pembatalan.
          </p>
        </aside>
      </div>
      <AddressEditor open={editor} onClose={() => setEditor(false)} />
    </div>
  );
}
export function Orders() {
  const { state } = useStore();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  if (!state.session)
    return (
      <div className="wrap">
        <Blank
          title="Masuk untuk melihat pesanan"
          text="Pesanan tersimpan di akun demo pada browser ini."
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
  const { state, transition, update } = useStore();
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");
  const o = state.orders.find((o) => o.id === id && o.email === state.session);
  if (!state.session)
    return (
      <div className="wrap">
        <Blank
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
