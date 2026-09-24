"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Search,
  Heart,
  ShoppingBag,
  UserRound,
  Menu,
  ArrowRight,
  ChevronRight,
  BookOpen,
  Star,
  Truck,
  ShieldCheck,
  Headphones,
  Bookmark,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetHeader,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { useStore } from "./provider";
import { money, ratingFor } from "@/lib/store/logic";
import type { Book, Format } from "@/lib/store/types";
export { Button, Input };
export const nav = [
  ["Katalog", "/katalog"],
  ["Pilihan Fritzoria", "/katalog?koleksi=pilihan"],
  ["Baru di katalog", "/katalog?urut=baru"],
  ["E-book", "/katalog?format=ebook"],
  ["Preorder", "/katalog?koleksi=preorder"],
  ["Promo", "/promo"],
];
export function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="pick">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, t]) => (
          <SelectItem key={v} value={v}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Go({
  href,
  children,
  outline = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  outline?: boolean;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant={outline ? "outline" : "default"}
      className={className}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
export function Blank({
  title,
  text,
  href = "/katalog",
  cta = "Jelajahi buku",
  pageTitle = false,
}: {
  title: string;
  text: string;
  href?: string;
  cta?: string;
  pageTitle?: boolean;
}) {
  const Heading = pageTitle ? "h1" : "h2";
  return (
    <Empty className="blank">
      <BookOpen size={32} />
      <Heading>{title}</Heading>
      <p>{text}</p>
      <Go href={href}>
        {cta}
        <ArrowRight size={16} />
      </Go>
    </Empty>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function CheckoutProgress({ current }: { current: number }) {
  const steps = ["Keranjang", "Pengiriman", "Pembayaran", "Selesai"];
  return (
    <ol className="checkout-progress" aria-label="Tahapan checkout">
      {steps.map((label, index) => {
        const step = index + 1;
        const complete = step < current;
        const active = step === current;
        return (
          <li
            key={label}
            className={complete ? "complete" : active ? "current" : ""}
            aria-current={active ? "step" : undefined}
          >
            <span aria-hidden="true">
              {complete ? <Check size={14} strokeWidth={2.5} /> : step}
            </span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}
export function Crumbs({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <Link href="/">Beranda</Link>
      {items.map(([label, href], i) => (
        <span key={i}>
          <ChevronRight size={13} />
          {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
        </span>
      ))}
    </nav>
  );
}
export function Cover({
  book,
  className = "",
}: {
  book: { title: string; cover: string };
  className?: string;
}) {
  const [fail, setFail] = useState(false);
  return fail ? (
    <div className={`cover-fallback ${className}`}>
      <BookOpen />
      <span>Sampul {book.title} tidak dapat dimuat</span>
      <button onClick={() => setFail(false)}>Coba lagi</button>
    </div>
  ) : (
    <img
      loading="lazy"
      src={book.cover}
      alt={`Sampul ${book.title}`}
      className={className}
      style={
        book.cover.endsWith("/laut-bercerita.webp")
          ? { aspectRatio: "2 / 3", objectFit: "cover" }
          : undefined
      }
      onError={() => setFail(true)}
    />
  );
}
export function Card({
  book,
  format = "fisik",
}: {
  book: Book;
  format?: Format;
}) {
  const { state, wish, add } = useStore();
  const r = ratingFor(book.slug, state.reviews);
  const ebook = format === "ebook";
  const price = ebook ? (book.ebookPrice ?? book.price) : book.price;
  const discount =
    !ebook && book.originalPrice > book.price
      ? Math.round((1 - book.price / book.originalPrice) * 100)
      : 0;
  return (
    <article className="book-card">
      <div className="cover-surface">
        <Link href={`/buku/${book.slug}`} className="cover-link">
          <Cover book={book} />
        </Link>
        {discount > 0 && <span className="discount">−{discount}%</span>}
        <button
          className={`save-book ${state.wish.includes(book.slug) ? "saved" : ""}`}
          aria-label={`${state.wish.includes(book.slug) ? "Hapus" : "Simpan"} ${book.title} ${state.wish.includes(book.slug) ? "dari" : "ke"} wishlist`}
          onClick={() => wish(book.slug)}
        >
          <Heart
            size={17}
            fill={state.wish.includes(book.slug) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <Link
        className="category-label"
        href={`/katalog?kategori=${encodeURIComponent(book.category)}`}
      >
        {book.category}
      </Link>
      <Link className="book-title" href={`/buku/${book.slug}`}>
        {book.title}
      </Link>
      <Link
        className="book-author"
        href={`/penulis/${encodeURIComponent(book.author)}`}
      >
        {book.author}
      </Link>
      <div className="book-rating">
        {r.count ? (
          <>
            <Star size={13} fill="currentColor" />
            {r.rating.toFixed(1)} <span>({r.count} ulasan)</span>
          </>
        ) : (
          <span>
            {book.language} ·{" "}
            {book.ebookPrice !== undefined ? "Fisik & e-book" : "Buku fisik"}
          </span>
        )}
      </div>
      <div className="price">{money(price)}</div>
      <div className="old-price">
        {ebook
          ? "Harga e-book"
          : discount > 0
            ? money(book.originalPrice)
            : book.stock === 0
              ? "Stok habis"
              : book.preorder
                ? "Preorder"
                : "Harga buku fisik"}
      </div>
      <Button
        variant="outline"
        className="card-add"
        disabled={ebook || book.preorder || !book.stock}
        onClick={() => add(book.slug, format)}
      >
        {ebook ? "Pembelian e-book belum tersedia" : book.preorder ? "Preorder belum tersedia" : book.stock === 0 ? "Stok habis" : "Tambah ke keranjang"}
      </Button>
    </article>
  );
}
export function Grid({ books, format }: { books: Book[]; format?: Format }) {
  return (
    <div className="books-grid">
      {books.map((b) => (
        <Card key={b.slug} book={b} format={format} />
      ))}
    </div>
  );
}
export function Collection({
  title,
  subtitle,
  books,
  href,
}: {
  title: string;
  subtitle: string;
  books: Book[];
  href: string;
}) {
  return (
    <section className="collection">
      <div className="section-head">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <Link href={href}>
          Lihat semua <ArrowRight size={16} />
        </Link>
      </div>
      <Grid books={books.slice(0, 6)} />
    </section>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const { state, books, ready, isAdmin } = useStore();
  const router = useRouter();
  const path = usePathname();
  const isCheckout = path === "/checkout";
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const profile = state.profiles.find((p) => p.email === state.session);
  const matches =
    q.trim().length > 1
      ? books
          .filter(
            (b) =>
              !b.hidden &&
              `${b.title} ${b.author}`.toLowerCase().includes(q.toLowerCase()),
          )
          .slice(0, 4)
      : [];
  return (
    <>
      <a href="#main" className="skip-link">
        Langsung ke konten
      </a>
      {!isCheckout && <div className="utility">
        <div className="wrap">
          <span>
            <BookOpen size={14} /> Fritzoria · Buku fisik & digital
          </span>
          <Link href="/bantuan">
            Pusat bantuan <ArrowRight size={13} />
          </Link>
        </div>
      </div>}
      <header className={`site-header${isCheckout ? " checkout-header" : ""}`}>
        <div className="wrap main-header">
          {!isCheckout && <Sheet>
            <SheetTrigger asChild>
              <button
                className="mobile-menu icon-button"
                aria-label="Buka menu"
              >
                <Menu />
              </button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Fritzoria</SheetTitle>
                <SheetDescription>
                  Jelajahi rak buku dan akunmu.
                </SheetDescription>
              </SheetHeader>
              <div className="mobile-links">
                {[
                  ...nav,
                  ["Wishlist", "/wishlist"],
                  ["Akun saya", "/akun"],
                  ["Bantuan", "/bantuan"],
                ].map(([label, href]) => (
                  <SheetClose asChild key={href}>
                    <Link href={href}>
                      {label}
                      <ChevronRight size={16} />
                    </Link>
                  </SheetClose>
                ))}
                {isAdmin && (
                  <SheetClose asChild>
                    <Link href="/admin">
                      Studio admin
                      <ChevronRight size={16} />
                    </Link>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>}
          <Link href="/" className="brand">
            <span className="brand-mark">f.</span>
            <span>
              Fritzoria<span className="brand-caption">BOOKSTORE</span>
            </span>
          </Link>
          {!isCheckout && <div className="search-wrap">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setFocused(false);
                router.push(`/katalog?q=${encodeURIComponent(q.trim())}`);
              }}
            >
              <Search size={19} />
              <input
                aria-label="Cari judul, penulis, atau ISBN"
                placeholder="Cari judul, penulis, atau ISBN"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
              />
              <button aria-label="Cari buku">
                <ArrowRight size={18} />
              </button>
            </form>
            {focused && matches.length > 0 && (
              <div className="search-results" onMouseDown={(e) => e.preventDefault()}>
                {matches.map((b) => (
                  <Link
                    key={b.slug}
                    href={`/buku/${b.slug}`}
                    onClick={() => setFocused(false)}
                  >
                    <Cover book={b} />
                    <span>
                      <strong>{b.title}</strong>
                      <small>{b.author}</small>
                    </span>
                  </Link>
                ))}
                <Link
                  href={`/katalog?q=${encodeURIComponent(q)}`}
                  onClick={() => setFocused(false)}
                >
                  Lihat seluruh hasil <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>}
          {isCheckout && (
            <div className="checkout-header-note">
              <ShieldCheck size={18} />
              <span>
                Checkout aman
                <small>COD asli atau Xendit Mode Tes</small>
              </span>
            </div>
          )}
          <div className="header-actions">
            <Link
              href="/wishlist"
              className="icon-button"
              aria-label="Wishlist"
            >
              <Heart />
              <span className="count">{state.wish.length || ""}</span>
            </Link>
            <Link href={profile ? "/akun" : "/masuk?next=/akun"} className="account-button" aria-label={profile ? "Akun saya" : "Masuk atau daftar"}>
              <UserRound />
              <span>
                {profile ? profile.name.split(" ")[0] : "Masuk"}
                <small>{profile ? "Akun saya" : "Daftar & masuk"}</small>
              </span>
            </Link>
            {isAdmin && (
              <Link href="/admin" className="account-button" aria-label="Studio admin">
                <ShieldCheck />
                <span>
                  Studio
                  <small>Kelola toko</small>
                </span>
              </Link>
            )}
            <Link
              href="/keranjang"
              className="icon-button"
              aria-label="Keranjang"
            >
              <ShoppingBag />
              <span className="count">
                {state.cart.reduce((n, l) => n + l.qty, 0) || ""}
              </span>
            </Link>
          </div>
        </div>
        {!isCheckout && <nav className="desktop-nav wrap" aria-label="Navigasi utama">
          {nav.map(([label, href]) => (
            <Link
              className={path === href ? "active" : ""}
              key={href}
              href={href}
            >
              {label}
            </Link>
          ))}
          <Link className="track" href="/pesanan">
            <Truck size={16} /> Lacak pesanan
          </Link>
        </nav>}
      </header>
      {!isCheckout && <div className="demo-line">
        Checkout buku fisik: COD untuk pesanan asli atau 13 VA/e-wallet Xendit Mode Tes tanpa uang sungguhan.
        E-book dan voucher belum dapat dibeli/digunakan. <Link href="/tentang">Pelajari</Link>
      </div>}
      <main id="main" tabIndex={-1}>
        {ready ? (
          children
        ) : (
          <div className="wrap loading-state" role="status">
            Memuat rak buku Fritzoria…
          </div>
        )}
      </main>
      <footer>
        <div className="wrap footer-top">
          <div>
            <Link href="/" className="brand">
              <span className="brand-mark">f.</span>
              <span>Fritzoria</span>
            </Link>
            <p>
              Buku untuk dibaca.
              <br />
              Cerita untuk dibawa pulang.
            </p>
          </div>
          {[
            [
              "Jelajahi",
              ["Seluruh buku", "/katalog"],
              ["E-book", "/katalog?format=ebook"],
              ["Penulis", "/penulis"],
              ["Promo", "/promo"],
            ],
            [
              "Layanan pembaca",
              ["Pesanan saya", "/pesanan"],
              ["Rak digital", "/rak-digital"],
              ["Pengiriman", "/pengiriman"],
              ["Pengembalian", "/pengembalian"],
            ],
            [
              "Tentang kami",
              ["Fritzoria", "/tentang"],
              ["Pusat bantuan", "/bantuan"],
              ["Hubungi kami", "/kontak"],
            ],
          ].map((col, i) => (
            <div key={i}>
              <h3>{col[0] as string}</h3>
              {(col.slice(1) as string[][]).map(([t, h]) => (
                <Link key={h} href={h}>
                  {t}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="wrap footer-bottom">
          <span>© {new Date().getFullYear()} Fritzoria</span>
          <div>
            <Link href="/sumber">Sumber katalog</Link>
            <Link href="/privasi">Privasi</Link>
            <Link href="/syarat">Syarat penggunaan</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
