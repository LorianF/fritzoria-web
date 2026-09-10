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
import type { State, Book, Format, OrderStatus } from "@/lib/store/types";
import { available } from "@/lib/store/logic";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadOrders } from "@/lib/supabase/orders";
import { fromDatabaseBook, type DatabaseBook } from "@/lib/supabase/books";
import {
  loadRemoteUserState,
  syncRemoteUserState,
} from "@/lib/supabase/user-state";
const KEY = "fritzoria-store-v2";
const CART_KEY = "fritzoria-cart-v1";
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
  ordersReady: boolean;
  ordersError: string;
  refreshOrders: () => Promise<void>;
  books: Book[];
  booksReady: boolean;
  booksError: string;
  refreshBooks: () => Promise<void>;
  acceptBooks: (books: Book[], deletedSlug?: string) => void;
  update: Update;
  add: (slug: string, format: Format, qty?: number) => boolean;
  wish: (slug: string) => void;
  transition: (id: string, status: OrderStatus) => void;
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
  const [ordersReady, setOrdersReady] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const refreshOrders = useCallback(async () => {
    const email = ref.current.session;
    try {
      const orders = await loadOrders();
      if (ref.current.session !== email) return;
      const next = { ...ref.current, orders };
      ref.current = next;
      setState(next);
      setOrdersError("");
    } catch {
      if (ref.current.session === email)
        setOrdersError("Pesanan tidak dapat dimuat. Coba muat ulang.");
    } finally {
      if (ref.current.session === email) setOrdersReady(true);
    }
  }, []);
  useEffect(() => {
    if (state.session) void refreshOrders();
  }, [state.session, refreshOrders]);
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
      localStorage.setItem(CART_KEY, JSON.stringify(next.cart));
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
          let cart = parsed.cart;
          const savedCart = localStorage.getItem(CART_KEY);
          if (savedCart) {
            const candidate = JSON.parse(savedCart);
            if (Array.isArray(candidate)) cart = candidate;
          }
          const next = { ...blank, ...parsed, cart };
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
            const savedCart = localStorage.getItem(CART_KEY);
            if (savedCart) {
              const candidate = JSON.parse(savedCart);
              if (Array.isArray(candidate)) n.cart = candidate;
            }
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
      const next = {
        ...current,
        profiles,
        session: email,
        orders: current.session === email ? current.orders : [],
      };
      ref.current = next;
      setState(next);
      if (current.session !== email || !email) {
        setOrdersReady(false);
        setOrdersError("");
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
    if (current.method === "COD") {
      toast.error(
        "Perubahan status pesanan COD belum tersedia pada tahap ini.",
      );
      return;
    }
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
  return (
    <Context.Provider
      value={{
        state,
        ready,
        accountReady,
        isAdmin,
        ordersReady,
        ordersError,
        refreshOrders,
        books,
        booksReady,
        booksError,
        refreshBooks,
        acceptBooks,
        update,
        add,
        wish,
        transition,
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
