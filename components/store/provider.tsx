"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast, Toaster } from "sonner";
import initial from "@/lib/store/catalog.json";
import type {
  State,
  Book,
  Format,
  Order,
  OrderStatus,
} from "@/lib/store/types";
import { available, cartError, totals, unit } from "@/lib/store/logic";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fromDatabaseBook, type DatabaseBook } from "@/lib/supabase/books";
import {
  loadRemoteUserState,
  syncRemoteUserState,
} from "@/lib/supabase/user-state";
const KEY = "fritzoria-store-v2";
const blank: State = {
  version: 2,
  profiles: [],
  session: null,
  cart: [],
  wish: [],
  addresses: [],
  orders: [],
  reviews: [],
  overrides: {},
  custom: [],
  tickets: [],
  vouchers: [
    {
      code: "BACA10",
      percent: 10,
      max: 30000,
      min: 150000,
      active: true,
      description: "Hemat 10%, maksimal Rp30.000. Minimum belanja Rp150.000.",
    },
    {
      code: "FRITZORIA15",
      percent: 15,
      max: 50000,
      min: 300000,
      active: true,
      description: "Hemat 15%, maksimal Rp50.000. Minimum belanja Rp300.000.",
    },
  ],
  banner: "Buku yang tepat, untuk setiap babak hidup.",
  seen: [],
  progress: {},
  bookmarks: {},
  subscribed: [],
};
type Update = (fn: (s: State) => State) => void;
const Context = createContext<{
  state: State;
  ready: boolean;
  accountReady: boolean;
  isAdmin: boolean;
  books: Book[];
  booksReady: boolean;
  booksError: string;
  refreshBooks: () => Promise<void>;
  acceptBooks: (books: Book[], deletedSlug?: string) => void;
  update: Update;
  add: (slug: string, format: Format, qty?: number) => boolean;
  wish: (slug: string) => void;
  transition: (id: string, status: OrderStatus) => void;
  place: (details: {
    addressId: string;
    courier: string;
    method: string;
    voucher: string;
    note: string;
  }) => string | null;
} | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(blank);
  const [ready, setReady] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [remoteBooks, setRemoteBooks] = useState<Book[] | null>(null);
  const [booksReady, setBooksReady] = useState(false);
  const [booksError, setBooksError] = useState("");
  const booksRequest = useRef(0);
  const refreshBooks = useCallback(async () => {
    const request = ++booksRequest.current;
    setBooksReady(false);
    try {
      const { data, error } = await getSupabaseBrowserClient()
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      if (request !== booksRequest.current) return;
      if (error) throw error;
      setRemoteBooks((data as DatabaseBook[]).map(fromDatabaseBook));
      setBooksError("");
    } catch {
      if (request === booksRequest.current)
        setBooksError(
          "Katalog tidak dapat dimuat. Periksa koneksi lalu coba lagi.",
        );
    } finally {
      if (request === booksRequest.current) setBooksReady(true);
    }
  }, []);
  const acceptBooks = (saved: Book[], deletedSlug?: string) => {
    ++booksRequest.current;
    setRemoteBooks((current) => [
      ...(current || []).filter(
        (b) =>
          b.slug !== deletedSlug && !saved.some((next) => next.slug === b.slug),
      ),
      ...saved,
    ]);
    setBooksReady(true);
  };
  const ref = useRef(state);
  const update: Update = (fn) => {
    const previous = ref.current;
    const next = fn(previous);
    ref.current = next;
    setState(next);
    void syncRemoteUserState(previous, next).catch(() =>
      toast.error("Perubahan belum tersinkron ke akun. Coba lagi."),
    );
    if (previous.session && next.session === null)
      void getSupabaseBrowserClient().auth.signOut();
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      toast.error(
        "Penyimpanan perangkat penuh. Perubahan ini hanya tersimpan selama halaman terbuka.",
      );
    }
  };
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed.version === 2 &&
          Array.isArray(parsed.orders) &&
          Array.isArray(parsed.cart) &&
          Array.isArray(parsed.profiles)
        ) {
          const next = { ...blank, ...parsed };
          ref.current = next;
          setState(next);
        } else toast.info("Data lama tidak kompatibel. Sesi baru digunakan.");
      }
    } catch {
      toast.error("Data lokal tidak dapat dibaca. Sesi baru digunakan.");
    }
    setReady(true);
    const sync = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          const n = JSON.parse(e.newValue);
          if (n.version === 2) {
            ref.current = n;
            setState(n);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", sync);
    const supabase = getSupabaseBrowserClient();
    const adopt = (email: string | null, name = "") => {
      const current = ref.current;
      const profiles =
        email && !current.profiles.some((p) => p.email === email)
          ? [
              ...current.profiles,
              { email, name: name || email.split("@")[0], phone: "" },
            ]
          : current.profiles;
      const next = { ...current, profiles, session: email };
      ref.current = next;
      setState(next);
      if (current.session !== email || !email) {
        setAccountReady(!email);
        setIsAdmin(false);
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
    };
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      adopt(user?.email || null, String(user?.user_metadata?.name || ""));
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user;
        adopt(user?.email || null, String(user?.user_metadata?.name || ""));
      },
    );
    return () => {
      window.removeEventListener("storage", sync);
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!state.session) return;
    let active = true;
    loadRemoteUserState()
      .then((remote) => {
        if (!active || !remote) return;
        const current = ref.current;
        const next: State = {
          ...current,
          profiles: [
            ...current.profiles.filter(
              (profile) => profile.email !== remote.email,
            ),
            remote.profile,
          ],
          addresses: [
            ...current.addresses.filter(
              (address) => address.email !== remote.email,
            ),
            ...remote.addresses,
          ],
          wish: remote.wish,
        };
        ref.current = next;
        setState(next);
        setIsAdmin(remote.isAdmin);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
      })
      .catch(() => toast.error("Data akun Supabase tidak dapat dimuat."))
      .finally(() => {
        if (active) setAccountReady(true);
      });
    return () => {
      active = false;
    };
  }, [state.session]);
  useEffect(() => {
    void refreshBooks();
  }, [refreshBooks, isAdmin, state.session]);
  const all = (s: State): Book[] =>
    remoteBooks !== null
      ? remoteBooks
      : [...(initial as Book[]), ...s.custom].map(
          (b) => s.overrides[b.slug] || b,
        );
  const books = all(state);
  const add = (slug: string, format: Format, qty = 1) => {
    const s = ref.current;
    const b = all(s).find((b) => b.slug === slug && !b.hidden);
    if (!b || !available(b, format)) {
      toast.error("Format ini sedang tidak tersedia.");
      return false;
    }
    const existing = s.cart.find((l) => l.slug === slug && l.format === format);
    if (format === "fisik" && (existing?.qty || 0) + qty > b.stock) {
      toast.error(`Tersisa ${b.stock} buku dalam stok simulasi.`);
      return false;
    }
    update((s) => ({
      ...s,
      cart: existing
        ? s.cart.map((l) =>
            l.slug === slug && l.format === format
              ? { ...l, qty: format === "ebook" ? 1 : l.qty + qty }
              : l,
          )
        : [...s.cart, { slug, format, qty: format === "ebook" ? 1 : qty }],
    }));
    toast.success(`${b.title} masuk keranjang`, {
      action: {
        label: "Lihat",
        onClick: () => window.location.assign("/keranjang"),
      },
    });
    return true;
  };
  const wish = (slug: string) => {
    const saved = ref.current.wish.includes(slug);
    update((s) => ({
      ...s,
      wish: saved ? s.wish.filter((x) => x !== slug) : [...s.wish, slug],
    }));
    toast.success(
      saved ? "Buku dihapus dari wishlist" : "Buku disimpan ke wishlist",
    );
  };
  const transition = (id: string, status: OrderStatus) => {
    const current = ref.current.orders.find((o) => o.id === id);
    if (!current) return;
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      "Menunggu pembayaran": [
        "Pembayaran gagal",
        "Diproses",
        "Selesai",
        "Dibatalkan",
      ],
      "Pembayaran gagal": ["Menunggu pembayaran", "Dibatalkan"],
      Diproses: ["Dikirim"],
      Dikirim: ["Selesai"],
      Selesai: ["Retur diajukan"],
      "Retur diajukan": ["Dikembalikan", "Selesai"],
      Dibatalkan: [],
      Dikembalikan: [],
    };
    if (!allowed[current.status].includes(status)) {
      toast.error("Perubahan status tidak valid.");
      return;
    }
    if (
      status === "Selesai" &&
      current.status === "Menunggu pembayaran" &&
      current.lines.some((l) => l.format === "fisik")
    )
      return;
    update((s) => {
      const overrides = { ...s.overrides };
      if (status === "Dibatalkan" || status === "Dikembalikan") {
        for (const l of current.lines.filter((l) => l.format === "fisik")) {
          const b = all(s).find((b) => b.slug === l.slug);
          if (b) overrides[b.slug] = { ...b, stock: b.stock + l.qty };
        }
      }
      return {
        ...s,
        overrides,
        orders: s.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status,
                history: [
                  ...o.history,
                  { status, date: new Date().toISOString() },
                ],
              }
            : o,
        ),
      };
    });
    toast.success(`Pesanan: ${status}`);
  };
  const place = (d: {
    addressId: string;
    courier: string;
    method: string;
    voucher: string;
    note: string;
  }) => {
    const s = ref.current;
    const bs = all(s);
    const error = cartError(s.cart, bs);
    if (error) {
      toast.error(error);
      return null;
    }
    const user = s.profiles.find((p) => p.email === s.session);
    if (!user) {
      toast.error("Masuk terlebih dahulu.");
      return null;
    }
    const v = s.vouchers.find((v) => v.code === d.voucher);
    const t = totals(s.cart, bs, v, d.courier);
    const address = s.addresses.find(
      (a) => a.id === d.addressId && a.email === s.session,
    );
    if (t.physical && !address) {
      toast.error("Tambahkan alamat pengiriman.");
      return null;
    }
    const id =
      "FR-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase();
    const date = new Date().toISOString();
    const order: Order = {
      id,
      email: user.email,
      name: user.name,
      date,
      lines: s.cart.map((l) => {
        const b = bs.find((b) => b.slug === l.slug)!;
        return {
          ...l,
          title: b.title,
          author: b.author,
          cover: b.cover,
          price: unit(b, l.format),
          readable: b.readable,
        };
      }),
      subtotal: t.subtotal,
      discount: t.discount,
      shipping: t.shipping,
      total: t.total,
      voucher: t.discount ? d.voucher : "",
      courier: t.physical ? d.courier : "Digital",
      method: d.method,
      address: t.physical ? address : undefined,
      status: "Menunggu pembayaran",
      history: [{ status: "Menunggu pembayaran", date }],
      note: d.note,
    };
    update((s) => {
      const overrides = { ...s.overrides };
      for (const l of s.cart.filter((l) => l.format === "fisik")) {
        const b = bs.find((b) => b.slug === l.slug)!;
        overrides[l.slug] = { ...b, stock: b.stock - l.qty };
      }
      return { ...s, cart: [], overrides, orders: [order, ...s.orders] };
    });
    return id;
  };
  return (
    <Context.Provider
      value={{
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
        add,
        wish,
        transition,
        place,
      }}
    >
      {children}
      <Toaster richColors position="bottom-right" closeButton />
    </Context.Provider>
  );
}
export function useStore() {
  const c = useContext(Context);
  if (!c) throw Error("Store provider missing");
  return c;
}
