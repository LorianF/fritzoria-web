"use client";
import Link from "next/link";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  BookOpen,
  Package,
  Users,
  Ticket,
  Star,
  MessageSquare,
  Plus,
  ArrowLeft,
  Tags,
  ArrowRight,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useStore } from "./provider";
import { Button, Input, Go, Cover, PageHead, Pick } from "./shared";
import { Confirm } from "./account";
import { money, slugify, isPaid, validISBN } from "@/lib/store/logic";
import type { Book, Profile } from "@/lib/store/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  saveBook,
  setBookHidden,
  deleteBook,
  bookError,
} from "@/lib/supabase/admin-books";
import { CategoriesPanel, useCategories } from './categories';
import { AdminSupport } from './support';
const sections = [
  ["Ringkasan", "", LayoutDashboard],
  ["Buku & stok", "produk", BookOpen],
  ["Kategori", "kategori", Tags],
  ["Pesanan", "pesanan", Package],
  ["Pelanggan", "pelanggan", Users],
  ["Promo & banner", "promo", Ticket],
  ["Ulasan", "ulasan", Star],
  ["Pesan bantuan", "bantuan", MessageSquare],
] as const;
function DataTable({
  heads,
  children,
}: {
  heads: string[];
  children: ReactNode;
}) {
  return (
    <div className="data-table">
      <Table>
        <TableHeader>
          <TableRow>
            {heads.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
export function Admin({ section = "" }: { section?: string }) {
  const {
    state,
    ready,
    accountReady,
    isAdmin,
    books,
    booksReady,
    booksError,
    refreshBooks,
    acceptBooks,
    update,
    transition,
    ordersReady,
    ordersError,
    refreshOrders,
  } = useStore();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [customersError, setCustomersError] = useState("");
  const [customersReady, setCustomersReady] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    getSupabaseBrowserClient().from("profiles").select("email,name,phone").order("created_at")
      .then(({data,error}) => {
        if (!active) return;
        if (error) setCustomersError("Pelanggan tidak dapat dimuat. Muat ulang halaman.");
        else { setCustomers(data || []); setCustomersError(""); }
        setCustomersReady(true);
      });
    return () => { active = false; };
  }, [isAdmin]);
  const [editing, setEditing] = useState<Book | null | undefined>(undefined);
  const [order, setOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const filteredBooks = books
    .filter(
      (b) =>
        `${b.title} ${b.author} ${b.isbn || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        (category === "all" || b.category === category) &&
        (filter === "all" ||
          (filter === "active" && !b.hidden) ||
          (filter === "hidden" && b.hidden) ||
          (filter === "low" && b.stock < 5) ||
          (filter === "preorder" && b.preorder)),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "id")
        : sort === "stock"
          ? a.stock - b.stock
          : b.added - a.added,
    );
  const pages = Math.max(1, Math.ceil(filteredBooks.length / 15));
  const currentPage = Math.min(page, pages);
  const mutate = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(bookError(error));
    } finally {
      setBusy(false);
    }
  };
  if (!ready || !accountReady)
    return <p className="loading-state">Memeriksa akses admin…</p>;
  if (!state.session)
    return (
      <div className="admin-gate">
        <span className="brand-mark">f.</span>
        <h1>Studio Fritzoria</h1>
        <p>
          Masuk menggunakan akun Supabase yang memiliki role admin untuk
          mengelola toko.
        </p>
        <Go href="/masuk?next=/admin">Masuk ke akun</Go>
        <Go href="/" outline>
          Kembali ke toko
        </Go>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="admin-gate">
        <span className="brand-mark">f.</span>
        <h1>Akses dibatasi</h1>
        <p>Akun {state.session} tidak memiliki izin mengelola Fritzoria.</p>
        <Go href="/">Kembali ke toko</Go>
      </div>
    );
  const paid = state.orders.filter(isPaid);
  const currentOrder = state.orders.find((o) => o.id === order);
  const titles = sections.find(([, s]) => s === section)?.[0] || "Ringkasan";
  return (
    <SidebarProvider>
      <Sidebar className="admin-sidebar">
        <SidebarHeader>
          <Link href="/admin" className="brand">
            <span className="brand-mark">f.</span>
            <span>
              Fritzoria<small className="brand-caption">STUDIO</small>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {sections.map(([name, s, I]) => (
                <SidebarMenuItem key={s}>
                  <SidebarMenuButton asChild isActive={section === s}>
                    <Link href={`/admin${s ? "/" + s : ""}`}>
                      <I size={18} />
                      <span>{name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Link href="/" className="text-link">
            <ArrowLeft size={17} /> Kembali ke toko
          </Link>
          <p className="small muted">Akses admin terverifikasi</p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="admin-header">
          <SidebarTrigger />
          <span>Fritzoria / {titles}</span>
          <span className="small-tag">Admin</span>
        </header>
        <div className="admin-main">
          <PageHead
            title={titles}
            description="Kelola katalog dan operasional Fritzoria."
          />
          {["", "pesanan", "pelanggan"].includes(section) && (!ordersReady || ordersError) && <p className="notice" role="status">{ordersError || "Memuat pesanan…"} {ordersError && <Button onClick={() => void refreshOrders()}>Coba lagi</Button>}</p>}
          {["", "pelanggan"].includes(section) && (!customersReady || customersError) && <p className="notice" role="status">{customersError || "Memuat pelanggan…"}</p>}
          {["promo", "ulasan"].includes(section) && <p className="notice">Fitur lokal: data pada bagian ini hanya tersimpan di browser ini dan belum tersinkron lintas perangkat. Voucher tidak berlaku pada checkout COD.</p>}
          {section === "" && (
            <>
              <div className="stat-grid four">
                <div>
                  <strong>
                    {money(paid.reduce((n, o) => n + o.total, 0))}
                  </strong>
                  <span>COD terkonfirmasi, di luar retur diterima</span>
                </div>
                <div>
                  <strong>{ordersReady && !ordersError ? state.orders.length : "—"}</strong>
                  <span>Pesanan akun pelanggan</span>
                </div>
                <div>
                  <strong>{books.filter((b) => !b.hidden).length}</strong>
                  <span>Buku aktif</span>
                </div>
                <div>
                  <strong>{customersReady && !customersError ? customers.length : "—"}</strong>
                  <span>Akun terdaftar</span>
                </div>
              </div>
              <div className="admin-columns">
                <section className="panel">
                  <h2>Pesanan terbaru</h2>
                  {state.orders.slice(0, 6).map((o) => (
                    <button
                      className="admin-order-mini"
                      key={o.id}
                      onClick={() => setOrder(o.id)}
                    >
                      <span>
                        {o.id}
                        <small>
                          {o.name} · {o.status}
                        </small>
                      </span>
                      <strong>{money(o.total)}</strong>
                    </button>
                  ))}
                  {!state.orders.length && (
                    <p className="muted">
                      Belum ada transaksi. Coba checkout dari toko untuk mengisi
                      dashboard ini.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h2>Perlu perhatian</h2>
                  <p>
                    {books.filter((b) => !b.hidden && b.stock < 5).length} buku
                    dengan stok di bawah 5
                  </p>
                  <p>
                    {state.orders.filter((o) => o.status === "Diproses").length}{" "}
                    pesanan menunggu pengiriman
                  </p>
                  <p>
                    {
                      state.orders.filter((o) => o.status === "Retur diajukan")
                        .length
                    }{" "}
                    permintaan retur
                  </p>
                  <Go href="/admin/pesanan" outline>
                    Kelola pesanan
                  </Go>
                </section>
              </div>
            </>
          )}
          {section === "produk" && (
            <>
              {booksError && (
                <p role="alert" className="notice">
                  {booksError}
                </p>
              )}
              {!booksReady && <p role="status">Memuat katalog…</p>}
              <div className="catalog-tools">
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Cari produk admin"
                  placeholder="Cari judul, penulis, ISBN"
                />
                <Button
                  variant="outline"
                  disabled={!booksReady || busy}
                  onClick={() => void refreshBooks()}
                >
                  Muat ulang
                </Button>
                <Button
                  disabled={!booksReady || !!booksError || busy}
                  onClick={() => setEditing(null)}
                >
                  <Plus size={16} /> Tambah buku
                </Button>
              </div>
              <div className="catalog-tools">
                <Pick
                  label="Status buku"
                  value={filter}
                  onChange={(v) => {
                    setFilter(v);
                    setPage(1);
                  }}
                  options={[
                    ["all", "Semua status"],
                    ["active", "Aktif"],
                    ["hidden", "Diarsipkan"],
                    ["low", "Stok di bawah 5"],
                    ["preorder", "Preorder"],
                  ]}
                />
                <Pick
                  label="Kategori buku"
                  value={category}
                  onChange={(v) => {
                    setCategory(v);
                    setPage(1);
                  }}
                  options={[
                    ["all", "Semua kategori"],
                    ...[...new Set(books.map((b) => b.category))]
                      .sort()
                      .map((c) => [c, c] as [string, string]),
                  ]}
                />
                <Pick
                  label="Urutan buku"
                  value={sort}
                  onChange={(v) => {
                    setSort(v);
                    setPage(1);
                  }}
                  options={[
                    ["newest", "Terbaru"],
                    ["title", "Judul A–Z"],
                    ["stock", "Stok terendah"],
                  ]}
                />
              </div>
              {booksReady && !booksError && (
                <p className="muted">{filteredBooks.length} buku ditemukan</p>
              )}
              <DataTable
                heads={[
                  "Buku",
                  "Kategori",
                  "Harga fisik",
                  "Stok",
                  "Status",
                  "Tindakan",
                ]}
              >
                {(booksReady && !booksError
                  ? filteredBooks.slice(
                      (currentPage - 1) * 15,
                      currentPage * 15,
                    )
                  : []
                ).map((b) => (
                  <TableRow key={b.slug}>
                    <TableCell>
                      <div className="table-book">
                        <Cover book={b} />
                        <span>
                          <strong>{b.title}</strong>
                          <small>{b.author}</small>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{b.category}</TableCell>
                    <TableCell>{money(b.price)}</TableCell>
                    <TableCell>{b.stock}</TableCell>
                    <TableCell>
                      <span className="small-tag">
                        {b.hidden
                          ? "Diarsipkan"
                          : b.preorder
                            ? "Preorder"
                            : "Aktif"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="button-row">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setEditing(b)}
                        >
                          Ubah
                        </Button>
                        <Confirm
                          title={b.hidden ? "Aktifkan buku?" : "Arsipkan buku?"}
                          text="Identitas dan riwayat pesanan tetap dipertahankan."
                          action={() =>
                            void mutate(async () => {
                              acceptBooks([
                                await setBookHidden(b.slug, !b.hidden),
                              ]);
                              toast.success(
                                b.hidden
                                  ? "Buku diaktifkan."
                                  : "Buku diarsipkan.",
                              );
                            })
                          }
                        >
                          <Button size="sm" variant="ghost" disabled={busy}>
                            {b.hidden ? "Aktifkan" : "Arsipkan"}
                          </Button>
                        </Confirm>
                        <Confirm
                          title={`Hapus permanen “${b.title}”?`}
                          text="Buku beserta wishlist dan ulasannya akan dihapus. Tindakan ini tidak dapat dibatalkan. Buku yang terkait pesanan harus diarsipkan."
                          action={() =>
                            void mutate(async () => {
                              await deleteBook(b.slug);
                              acceptBooks([], b.slug);
                              toast.success("Buku dihapus permanen.");
                            })
                          }
                        >
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                          >
                            Hapus
                          </Button>
                        </Confirm>
                        <Link
                          href={`/buku/${b.slug}`}
                          aria-label={`Lihat ${b.title}`}
                        >
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
              {booksReady && !booksError && !filteredBooks.length && (
                <p className="empty-table">
                  Tidak ada buku yang cocok. Ubah filter atau tambahkan buku
                  baru.
                </p>
              )}
              <div className="button-row">
                <Button
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Sebelumnya
                </Button>
                <span>
                  Halaman {currentPage} dari {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </>
          )}
          {section === "kategori" && (
            <CategoriesPanel />
          )}
          {section === "pesanan" && (
            <>
              <div className="catalog-tools">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari ID, nama, atau email"
                  aria-label="Cari pesanan admin"
                />
                <Pick
                  value={filter}
                  onChange={setFilter}
                  label="Filter status admin"
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
              <DataTable
                heads={[
                  "Pesanan",
                  "Pelanggan",
                  "Tanggal",
                  "Total",
                  "Status",
                  "Tindakan",
                ]}
              >
                {state.orders
                  .filter(
                    (o) =>
                      (filter === "all" || o.status === filter) &&
                      `${o.id} ${o.name} ${o.email}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.id}</TableCell>
                      <TableCell>
                        {o.name}
                        <small className="block muted">{o.email}</small>
                      </TableCell>
                      <TableCell>
                        {new Date(o.date).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell>{money(o.total)}</TableCell>
                      <TableCell>
                        <span className="small-tag">{o.status}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrder(o.id)}
                        >
                          Kelola
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </DataTable>
              {!state.orders.length && (
                <p className="empty-table">{ordersReady && !ordersError ? "Belum ada pesanan." : "Menunggu data pesanan dari server."}</p>
              )}
            </>
          )}
          {section === "pelanggan" && (
            <DataTable heads={["Nama", "Email", "Pesanan", "Pembayaran terkonfirmasi"]}>
              {customers.map((p) => (
                <TableRow key={p.email}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    {state.orders.filter((o) => o.email === p.email).length}
                  </TableCell>
                  <TableCell>
                    {money(
                      paid
                        .filter((o) => o.email === p.email)
                        .reduce((n, o) => n + o.total, 0),
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}
          {section === "promo" && (
            <>
              <form
                className="panel form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const banner = String(
                    new FormData(e.currentTarget).get("banner") || "",
                  ).trim();
                  if (banner) update((s) => ({ ...s, banner }));
                  toast.success("Banner beranda diperbarui.");
                }}
              >
                <h2>Pesan utama beranda</h2>
                <label>
                  Judul banner
                  <Input
                    name="banner"
                    required
                    maxLength={85}
                    defaultValue={state.banner}
                  />
                </label>
                <Button type="submit">Simpan banner</Button>
              </form>
              <div className="panel">
                <h2>Voucher aktif</h2>
                {state.vouchers.map((v) => (
                  <div key={v.code} className="voucher-admin">
                    <div>
                      <strong>{v.code}</strong>
                      <p>{v.description}</p>
                    </div>
                    <Switch
                      checked={v.active}
                      aria-label={`Aktifkan ${v.code}`}
                      onCheckedChange={(value) =>
                        update((s) => ({
                          ...s,
                          vouchers: s.vouchers.map((x) =>
                            x.code === v.code ? { ...x, active: value } : x,
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <form
                className="panel form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  const code = String(fd.get("code")).trim().toUpperCase();
                  const percent = Number(fd.get("percent"));
                  const min = Number(fd.get("min"));
                  const max = Number(fd.get("max"));
                  if (state.vouchers.some((v) => v.code === code)) {
                    toast.error("Kode sudah digunakan.");
                    return;
                  }
                  update((s) => ({
                    ...s,
                    vouchers: [
                      ...s.vouchers,
                      {
                        code,
                        percent,
                        min,
                        max,
                        active: true,
                        description: `Hemat ${percent}%, maksimal ${money(max)}. Minimum ${money(min)}.`,
                      },
                    ],
                  }));
                  form.reset();
                  toast.success("Voucher ditambahkan.");
                }}
              >
                <h2 className="span-two">Tambah voucher</h2>
                <label>
                  Kode
                  <Input name="code" required pattern="[A-Za-z0-9]{3,20}" />
                </label>
                <label>
                  Diskon (%)
                  <Input
                    name="percent"
                    type="number"
                    min={1}
                    max={100}
                    required
                  />
                </label>
                <label>
                  Minimum belanja
                  <Input name="min" type="number" min={0} required />
                </label>
                <label>
                  Maksimum potongan
                  <Input name="max" type="number" min={1} required />
                </label>
                <Button type="submit" className="span-two">
                  Tambah voucher
                </Button>
              </form>
            </>
          )}
          {section === "ulasan" && (
            <div className="panel">
              <h2>Ulasan dari pembelian lokal</h2>
              {state.reviews.map((r) => (
                <div className="review-admin" key={r.id}>
                  <div>
                    <strong>
                      {books.find((b) => b.slug === r.slug)?.title}
                    </strong>
                    <p>
                      {r.name} · {"★".repeat(r.rating)}
                    </p>
                    <p>{r.text}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        reviews: s.reviews.map((x) =>
                          x.id === r.id ? { ...x, hidden: !r.hidden } : x,
                        ),
                      }))
                    }
                  >
                    {r.hidden ? "Tampilkan" : "Sembunyikan"}
                  </Button>
                </div>
              ))}
              {!state.reviews.length && (
                <p className="muted">Belum ada ulasan.</p>
              )}
            </div>
          )}
          {section === "bantuan" && (
            <AdminSupport />
          )}
        </div>
      </SidebarInset>
      {editing !== undefined && (
        <BookEditor book={editing} close={() => setEditing(undefined)} />
      )}
      <Dialog open={!!currentOrder} onOpenChange={(v) => !v && setOrder(null)}>
        <DialogContent className="order-dialog">
          <DialogHeader>
            <DialogTitle>{currentOrder?.id}</DialogTitle>
            <DialogDescription>
              Kelola pesanan COD. Perubahan tersimpan di server.
            </DialogDescription>
          </DialogHeader>
          {currentOrder && (
            <>
              <p>
                <strong>{currentOrder.name}</strong> · {currentOrder.email}
              </p>
              <p>
                Status: <strong>{currentOrder.status}</strong>
              </p>
              {currentOrder.lines.map((l) => (
                <p key={`${l.slug}-${l.format}`}>
                  {l.qty} × {l.title} · {l.format} · {money(l.price * l.qty)}
                </p>
              ))}
              <p>
                Total: <strong>{money(currentOrder.total)}</strong>
              </p>
              {currentOrder.address && (
                <p className="muted">
                  {currentOrder.address.street}, {currentOrder.address.city}
                </p>
              )}
              {currentOrder.returnReason && (
                <p className="notice">Retur: {currentOrder.returnReason}</p>
              )}
              <div className="button-row">
                {currentOrder.method === "COD" && currentOrder.status === "Menunggu pembayaran" && (
                  <Button onClick={() => void transition(currentOrder.id, "Diproses")}>Proses pesanan COD</Button>
                )}
                {currentOrder.status === "Diproses" && (
                  <Button
                    onClick={() => transition(currentOrder.id, "Dikirim")}
                  >
                    Tandai dikirim
                  </Button>
                )}
                {currentOrder.status === "Dikirim" && (
                  <Button
                    onClick={() => transition(currentOrder.id, "Selesai")}
                  >
                    Konfirmasi diterima & COD dibayar
                  </Button>
                )}
                {currentOrder.status === "Retur diajukan" && (
                  <>
                    <Confirm
                      title="Barang retur sudah diterima?"
                      text="Stok akan dikembalikan. Pengembalian dana harus ditangani toko secara terpisah; tindakan ini tidak mentransfer uang."
                      action={() => transition(currentOrder.id, "Dikembalikan")}
                    >
                      <Button>Setujui retur</Button>
                    </Confirm>
                    <Button
                      variant="outline"
                      onClick={() => transition(currentOrder.id, "Selesai")}
                    >
                      Tolak retur
                    </Button>
                  </>
                )}
                {["Menunggu pembayaran", "Pembayaran gagal", "Diproses"].includes(
                  currentOrder.status,
                ) && (
                  <Confirm
                    title="Batalkan pesanan ini?"
                    text="Stok fisik dikembalikan."
                    action={() => transition(currentOrder.id, "Dibatalkan")}
                  >
                    <Button variant="outline">Batalkan pesanan</Button>
                  </Confirm>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function BookEditor({ book, close }: { book: Book | null; close: () => void }) {
  const { categories, loading: categoriesLoading, error: categoriesError, reload: reloadCategories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState(book?.category || '');
  const { books, acceptBooks } = useStore();
  const [cover, setCover] = useState(book?.cover || "");
  const [coverFile, setCoverFile] = useState<File>();
  const [coverLoading, setCoverLoading] = useState(false);
  const coverRequest = useRef(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isEbook, setIsEbook] = useState(book?.ebookPrice !== undefined);
  const [preorder, setPreorder] = useState(!!book?.preorder);
  return (
    <Dialog open onOpenChange={(v) => !v && !saving && close()}>
      <DialogContent className="book-editor">
        <DialogHeader>
          <DialogTitle>{book ? "Ubah buku" : "Tambah buku"}</DialogTitle>
          <DialogDescription>
            Lengkapi informasi, harga, dan ketersediaan buku. Perubahan akan
            tampil di katalog setelah disimpan.
          </DialogDescription>
        </DialogHeader>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving || coverLoading || categoriesLoading || categoriesError) return;
            if (!categories.some(c => c.name === selectedCategory)) {
              setError('Pilih kategori yang tersedia sebelum menyimpan buku.');
              return;
            }
            const f = new FormData(e.currentTarget);
            f.set('category', selectedCategory);
            const str = (k: string) => String(f.get(k) || "").trim();
            const num = (k: string) => Number(f.get(k));
            const slug = book?.slug || slugify(str("title"));
            if (
              !slug ||
              slug.length > 200 ||
              (!book && books.some((b) => b.slug === slug))
            ) {
              toast.error("Judul atau URL buku sudah digunakan.");
              return;
            }
            if (!cover) {
              toast.error("Unggah sampul buku terlebih dahulu.");
              return;
            }
            if (
              ["title", "author", "category", "language", "source"].some(
                (k) => !str(k),
              ) ||
              str("summary").length < 20
            ) {
              toast.error("Lengkapi metadata dan ringkasan yang valid.");
              return;
            }
            if (!/^https?:\/\//.test(str("source"))) {
              toast.error("Sumber harus berupa URL HTTP atau HTTPS.");
              return;
            }
            const price = num("price");
            const originalPrice = str("originalPrice") === "" ? price : num("originalPrice");
            if (
              [
                price,
                originalPrice,
                num("stock"),
                ...(isEbook ? [num("ebookPrice")] : []),
              ].some((v) => !Number.isSafeInteger(v) || v < 0 || v > 2147483647)
            ) {
              toast.error(
                "Harga dan stok harus berupa bilangan bulat antara 0 dan 2.147.483.647.",
              );
              return;
            }
            if (originalPrice < price) {
              toast.error(
                "Harga sebelum diskon tidak boleh di bawah harga jual.",
              );
              return;
            }
            const isbn = str("isbn");
            if (isbn && !validISBN(isbn)) {
              toast.error(
                "ISBN tidak valid. Periksa angka dan digit pemeriksanya.",
              );
              return;
            }
            const next: Book & { readerText?: string } = {
              ...book,
              slug,
              title: str("title"),
              author: str("author"),
              category: str("category"),
              language: str("language"),
              publisher: str("publisher") || undefined,
              isbn: isbn || undefined,
              pages: num("pages") || undefined,
              year: str("year") || undefined,
              summary: str("summary"),
              source: str("source"),
              cover,
              price,
              originalPrice,
              stock: num("stock"),
              ebookPrice: isEbook ? num("ebookPrice") : undefined,
              preorder,
              releaseDate: preorder ? str("releaseDate") : undefined,
              added: book?.added || Date.now(),
              featured: f.get("featured") === "on",
              hidden: f.get("hidden") === "on",
            };
            setSaving(true);
            setError("");
            try {
              acceptBooks([await saveBook(next, !!book, coverFile)]);
              toast.success("Buku tersimpan di katalog.");
              close();
            } catch (failure) {
              setError(bookError(failure));
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving} className="contents">
            {error && (
              <p className="notice span-two" role="alert">
                {error}
              </p>
            )}
            {book && (
              <p className="muted span-two">
                URL buku: /buku/{book.slug} (tetap)
              </p>
            )}
            {[
              ["title", "Judul buku"],
              ["author", "Penulis"],
              ["language", "Bahasa"],
              ["publisher", "Penerbit"],
              ["year", "Tahun terbit"],
              ["isbn", "ISBN"],
              ["source", "URL sumber identitas"],
            ].map(([k, l]) => (
              <label
                key={k}
                className={k === "title" || k === "source" ? "span-two" : ""}
              >
                {l}
                <Input
                  name={k}
                  required={!["publisher", "isbn", "year"].includes(k)}
                  type={k === "source" ? "url" : "text"}
                  defaultValue={String(book?.[k as keyof Book] || "")}
                  maxLength={k === "isbn" ? 13 : 500}
                />
              </label>
            ))}
            <div className="span-two">
              <p>Kategori buku</p>
              {categoriesLoading ? <p role="status">Memuat kategori…</p> : categoriesError ? <p className="notice" role="alert">{categoriesError}</p> : (
                <Pick label="Pilih kategori buku" value={categories.some(c => c.name === selectedCategory) ? selectedCategory : ''} onChange={setSelectedCategory} options={categories.map(c => [c.name, c.name])} />
              )}
              {!categoriesLoading && !categoriesError && !categories.length && <p>Belum ada kategori. Tambahkan melalui menu Kategori terlebih dahulu.</p>}
              <Button type="button" variant="ghost" disabled={categoriesLoading || saving} onClick={() => void reloadCategories()}>Muat ulang kategori</Button>
              <Link href="/admin/kategori" target="_blank" rel="noopener noreferrer" className="text-link">Kelola kategori (tab baru)</Link>
            </div>
            {[
              ["price", "Harga jual"],
              ["originalPrice", "Harga sebelum diskon (opsional)"],
              ["stock", "Stok fisik"],
              ["pages", "Jumlah halaman"],
            ].map(([k, l]) => (
              <label key={k}>
                {l}
                <Input
                  name={k}
                  type="number"
                  required={k !== "pages" && k !== "originalPrice"}
                  placeholder={k === "originalPrice" ? "Kosongkan jika tidak ada diskon" : undefined}
                  min={k === "pages" ? 1 : 0}
                  step={1}
                  defaultValue={
                    book?.[k as keyof Book] === undefined || (k === "originalPrice" && book.originalPrice === book.price)
                      ? undefined
                      : Number(book[k as keyof Book])
                  }
                />
              </label>
            ))}
            <label className="span-two">
              Ringkasan editorial
              <textarea
                name="summary"
                required
                minLength={20}
                maxLength={1500}
                defaultValue={book?.summary}
              />
            </label>
            <label className="span-two">
              Sampul buku (JPG, PNG, WebP, maks. 2 MB)
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const request = ++coverRequest.current;
                  setCoverLoading(false);
                  if (
                    file.size > 2 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    )
                  ) {
                    toast.error("Gunakan gambar JPG/PNG/WebP maksimal 2 MB.");
                    e.target.value = "";
                    return;
                  }
                  const fr = new FileReader();
                  setCoverLoading(true);
                  const failed = () => {
                    if (request !== coverRequest.current) return;
                    setCoverLoading(false);
                    toast.error('File gambar tidak dapat dibaca. Pilih gambar lain.');
                  };
                  fr.onerror = failed;
                  fr.onload = () => {
                    const image = new Image();
                    image.onload = () => {
                      if (request !== coverRequest.current) return;
                      setCover(String(fr.result));
                      setCoverFile(file);
                      setCoverLoading(false);
                    };
                    image.onerror = failed;
                    image.src = String(fr.result);
                  };
                  fr.readAsDataURL(file);
                }}
              />
              {cover && (
                <img
                  src={cover}
                  alt="Pratinjau sampul"
                  className="upload-preview"
                />
              )}
            </label>
            <label className="check-label">
              <Switch checked={isEbook} onCheckedChange={setIsEbook} /> Sediakan
              e-book
            </label>
            {isEbook && (
              <label>
                Harga e-book
                <Input
                  required
                  name="ebookPrice"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={book?.ebookPrice}
                />
              </label>
            )}
            {isEbook && (
              <p className="muted span-two">
                Harga e-book mengatur katalog. Pengunggahan dan akses naskah
                digital belum tersedia di tahap ini.
              </p>
            )}
            <label className="check-label">
              <Switch checked={preorder} onCheckedChange={setPreorder} />{" "}
              Preorder
            </label>
            {preorder && (
              <label>
                Estimasi tersedia
                <Input
                  name="releaseDate"
                  type="date"
                  required
                  defaultValue={book?.releaseDate}
                />
              </label>
            )}
            <label className="check-label">
              <input
                name="hidden"
                type="checkbox"
                defaultChecked={book?.hidden}
              />{" "}
              Arsipkan (sembunyikan dari toko)
            </label>
            <label className="check-label">
              <input
                name="featured"
                type="checkbox"
                defaultChecked={book?.featured}
              />{" "}
              Pilihan Fritzoria
            </label>
            <Button type="submit" className="span-two" disabled={saving || coverLoading || categoriesLoading || !!categoriesError || !categories.some(c => c.name === selectedCategory)}>
              {saving ? "Menyimpan buku…" : "Simpan buku"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="span-two"
              onClick={close}
              disabled={saving}
            >
              Batal
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
