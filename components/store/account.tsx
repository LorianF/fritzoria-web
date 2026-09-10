"use client";
import { uid } from "@/lib/store/logic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  UserRound,
  MapPin,
  Package,
  BookOpen,
  Heart,
  Bell,
  Settings,
  LogOut,
  Plus,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "./provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button, Input, Go, PageHead, Crumbs, Blank } from "./shared";
import { isPaid, money } from "@/lib/store/logic";
import type { Address } from "@/lib/store/types";
export function Confirm({
  children,
  title,
  text,
  action,
}: {
  children: ReactNode;
  title: string;
  text: string;
  action: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={action}>Ya, lanjutkan</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function AddressEditor({
  open,
  onClose,
  address,
}: {
  open: boolean;
  onClose: () => void;
  address?: Address;
}) {
  const { state, update } = useStore();
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="address-dialog">
        <DialogHeader>
          <DialogTitle>{address ? "Ubah alamat" : "Tambah alamat"}</DialogTitle>
          <DialogDescription>
            Alamat ini tersimpan aman di akun Supabase Anda.
          </DialogDescription>
        </DialogHeader>
        <form
          key={address?.id || "new"}
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const v = (k: string) => String(fd.get(k) || "").trim();
            if (!state.session) return;
            const data: Address = {
              id: address?.id || uid(),
              email: state.session,
              label: v("label"),
              name: v("name"),
              phone: v("phone"),
              city: v("city"),
              province: v("province"),
              postal: v("postal"),
              street: v("street"),
              primary:
                fd.get("primary") === "on" ||
                !state.addresses.some((a) => a.email === state.session),
            };
            if (
              !data.label ||
              !data.name ||
              !data.city ||
              !data.province ||
              data.street.length < 8
            ) {
              setError("Lengkapi alamat dengan data yang valid.");
              return;
            }
            if (!/^\+?[0-9\s-]{9,16}$/.test(data.phone)) {
              setError("Nomor telepon harus 9–16 karakter angka.");
              return;
            }
            if (!/^\d{5}$/.test(data.postal)) {
              setError("Kode pos harus 5 digit.");
              return;
            }
            update((s) => ({
              ...s,
              addresses: [
                ...s.addresses
                  .filter((a) => a.id !== data.id)
                  .map((a) =>
                    a.email === s.session && data.primary
                      ? { ...a, primary: false }
                      : a,
                  ),
                data,
              ],
            }));
            toast.success("Alamat tersimpan.");
            onClose();
          }}
        >
          {[
            ["label", "Label alamat", "Rumah"],
            ["name", "Nama penerima", "Nama penerima"],
            ["phone", "Nomor telepon", "081234567890"],
            ["province", "Provinsi", "Jawa Tengah"],
            ["city", "Kota / kabupaten", "Semarang"],
            ["postal", "Kode pos", "50275"],
          ].map(([n, l, p]) => (
            <label key={n}>
              {l}
              <Input
                name={n}
                required
                maxLength={n === "postal" ? 5 : 100}
                defaultValue={(address?.[n as keyof Address] as string) || ""}
                placeholder={p}
              />
            </label>
          ))}
          <label className="span-two">
            Alamat lengkap
            <textarea
              required
              name="street"
              minLength={8}
              defaultValue={address?.street || ""}
              placeholder="Jalan, nomor rumah, kecamatan, dan patokan"
            />
          </label>
          <label className="check-label span-two">
            <input
              name="primary"
              type="checkbox"
              defaultChecked={address?.primary}
            />{" "}
            Jadikan alamat utama
          </label>
          {error && (
            <p className="form-error span-two" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="span-two">
            Simpan alamat
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function Auth({ mode = "masuk" }: { mode?: string }) {
  const { state, update } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const register = mode === "daftar";
  const reset = mode === "lupa-sandi";
  const raw = params.get("next") || "/akun";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/akun";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password") || "");
    const name = String(data.get("name") || "").trim();
    try {
      const supabase = getSupabaseBrowserClient();
      if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/akun/pengaturan`,
        });
        if (error) throw error;
        setResetSent(true);
        return;
      }
      if (register) {
        if (!name) throw Error("Isi nama terlebih dahulu.");
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (result.session) {
          update((s) => ({
            ...s,
            profiles: s.profiles.some((p) => p.email === email)
              ? s.profiles
              : [...s.profiles, { name, email, phone: "" }],
            session: email,
          }));
          toast.success("Akun berhasil dibuat.");
          router.push(next);
        } else {
          toast.success("Periksa email untuk mengonfirmasi akun.");
          router.push("/masuk");
        }
        return;
      }
      const { data: result, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const displayName = String(
        result.user.user_metadata?.name || email.split("@")[0],
      );
      update((s) => ({
        ...s,
        profiles: s.profiles.some((p) => p.email === email)
          ? s.profiles
          : [...s.profiles, { name: displayName, email, phone: "" }],
        session: email,
      }));
      toast.success("Selamat datang kembali.");
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tidak dapat masuk.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap auth-layout">
      <div className="auth-story">
        <p className="eyebrow">SELAMAT DATANG DI FRITZORIA</p>
        <h1>
          Rak pribadi untuk
          <br />
          cerita-ceritamu.
        </h1>
        <p>
          Simpan pilihanmu, ikuti pesanan, dan lanjutkan membaca dari tempat
          terakhir.
        </p>
        <BookOpen size={60} />
      </div>
      <div className="auth-form">
        <h2>
          {reset
            ? "Atur ulang sandi"
            : register
              ? "Buat akun pembaca"
              : "Masuk ke Fritzoria"}
        </h2>
        <p className="muted">
          Akun diamankan oleh Supabase dan dapat digunakan kembali di perangkat
          lain.
        </p>
        {resetSent ? (
          <div className="notice" role="status">
            Tautan pemulihan sudah dikirim. Periksa kotak masuk dan folder spam.
          </div>
        ) : (
          <form onSubmit={submit}>
            {register && (
              <label>
                Nama lengkap
                <Input
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <Input name="email" type="email" required autoComplete="email" />
            </label>
            {!reset && (
              <label>
                Sandi
                <Input
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder="Minimal 8 karakter"
                />
              </label>
            )}
            {register && (
              <label className="check-label">
                <input type="checkbox" required /> Saya menyetujui syarat
                penggunaan dan kebijakan privasi.
              </label>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button type="submit" className="wide" disabled={busy}>
              {busy
                ? "Memproses…"
                : reset
                  ? "Kirim tautan pemulihan"
                  : register
                    ? "Daftar"
                    : "Masuk"}
            </Button>
          </form>
        )}
        {!reset && (
          <Link className="text-link" href="/lupa-sandi">
            Lupa sandi?
          </Link>
        )}
        <div className="or">
          <span>atau</span>
        </div>
        <Button
          variant="outline"
          className="wide"
          onClick={() => {
            const email = "pembaca@fritzoria.example";
            if (!state.profiles.some((p) => p.email === email))
              update((s) => ({
                ...s,
                profiles: [
                  ...s.profiles,
                  { email, name: "Pembaca Fritzoria", phone: "" },
                ],
                session: email,
              }));
            else update((s) => ({ ...s, session: email }));
            router.push(next);
          }}
        >
          Coba tanpa akun <ArrowRight size={16} />
        </Button>
        <p className="muted center">
          {register ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
          <Link
            href={
              register ? `/masuk?next=${encodeURIComponent(next)}` : `/daftar?next=${encodeURIComponent(next)}`
            }
            className="text-link"
          >
            {register ? "Masuk" : "Daftar"}
          </Link>
        </p>
      </div>
    </div>
  );
}
const menu = [
  ["Ringkasan", "/akun", UserRound],
  ["Pesanan saya", "/pesanan", Package],
  ["Daftar alamat", "/akun/alamat", MapPin],
  ["Wishlist", "/wishlist", Heart],
  ["Rak digital", "/rak-digital", BookOpen],
  ["Notifikasi", "/akun/notifikasi", Bell],
  ["Pengaturan", "/akun/pengaturan", Settings],
] as const;
export function Account({ section = "ringkasan" }: { section?: string }) {
  const { state, update, isAdmin } = useStore();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState<Address | undefined>();
  const profile = state.profiles.find((p) => p.email === state.session);
  if (!profile)
    return (
      <div className="wrap">
        <Blank
          pageTitle
          title="Masuk ke akun Anda"
          text="Masuk untuk menyimpan profil, alamat, dan pesanan di akunmu."
          href="/masuk"
          cta="Masuk ke akun"
        />
      </div>
    );
  const orders = state.orders.filter((o) => o.email === profile.email);
  const addresses = state.addresses.filter((a) => a.email === profile.email);
  return (
    <div className="wrap">
      <Crumbs
        items={[
          ["Akun", "/akun"],
          [section === "ringkasan" ? "Ringkasan" : section, ""],
        ]}
      />
      <div className="account-layout">
        <aside className="account-sidebar">
          <div className="profile-badge">
            <span>{profile.name[0].toUpperCase()}</span>
            <strong>{profile.name}</strong>
            <small>{profile.email}</small>
          </div>
          <nav>
            {menu.map(([t, h, I]) => (
              <Link key={h} href={h}>
                <I size={18} />
                {t}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin">
                <LayoutDashboard size={18} />
                Studio admin
              </Link>
            )}
            <button
              onClick={() => {
                update((s) => ({ ...s, session: null }));
                router.push("/");
                toast.success("Berhasil keluar.");
              }}
            >
              <LogOut size={18} /> Keluar
            </button>
          </nav>
        </aside>
        <section>
          <PageHead
            title={
              section === "alamat"
                ? "Daftar alamat"
                : section === "pengaturan"
                  ? "Pengaturan akun"
                  : section === "notifikasi"
                    ? "Notifikasi"
                    : `Halo, ${profile.name.split(" ")[0]}.`
            }
            description={
              section === "ringkasan"
                ? "Semua perjalanan membacamu dimulai di sini."
                : undefined
            }
          />
          {section === "ringkasan" && (
            <>
              <div className="stat-grid">
                <Link href="/pesanan">
                  <Package />
                  <strong>{orders.length}</strong>
                  <span>Pesanan</span>
                </Link>
                <Link href="/wishlist">
                  <Heart />
                  <strong>{state.wish.length}</strong>
                  <span>Wishlist</span>
                </Link>
                <Link href="/rak-digital">
                  <BookOpen />
                  <strong>
                    {
                      new Set(
                        orders
                          .filter(isPaid)
                          .flatMap((o) =>
                            o.lines
                              .filter((l) => l.format === "ebook")
                              .map((l) => l.slug),
                          ),
                      ).size
                    }
                  </strong>
                  <span>E-book dibeli</span>
                </Link>
              </div>
              <div className="panel">
                <h2>Pesanan terakhir</h2>
                {orders.length ? (
                  <>
                    <p>
                      {orders[0].id} · {orders[0].status}
                    </p>
                    <p>{money(orders[0].total)}</p>
                    <Go href={`/pesanan/${orders[0].id}`} outline>
                      Lihat pesanan
                    </Go>
                  </>
                ) : (
                  <p className="muted">
                    Belum ada pesanan. Temukan buku pertamamu di katalog.
                  </p>
                )}
              </div>
              <Go href="/katalog">
                Cari bacaan berikutnya <ArrowRight size={16} />
              </Go>
              {isAdmin && (
                <Go href="/admin" outline>
                  Buka Studio admin <LayoutDashboard size={16} />
                </Go>
              )}
            </>
          )}
          {section === "alamat" && (
            <>
              <Button
                onClick={() => {
                  setAddress(undefined);
                  setEditing(true);
                }}
              >
                <Plus size={16} /> Tambah alamat
              </Button>
              <div className="addresses">
                {addresses.map((a) => (
                  <div className="panel" key={a.id}>
                    <div className="section-head">
                      <strong>{a.label}</strong>
                      {a.primary && <span className="small-tag">Utama</span>}
                    </div>
                    <p>
                      {a.name} · {a.phone}
                    </p>
                    <p className="muted">
                      {a.street}
                      <br />
                      {a.city}, {a.province} {a.postal}
                    </p>
                    <div className="button-row">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddress(a);
                          setEditing(true);
                        }}
                      >
                        Ubah
                      </Button>
                      {!a.primary && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              addresses: s.addresses.map((x) =>
                                x.email === s.session
                                  ? { ...x, primary: x.id === a.id }
                                  : x,
                              ),
                            }))
                          }
                        >
                          Jadikan utama
                        </Button>
                      )}
                      <Confirm
                        title="Hapus alamat?"
                        text="Alamat pada pesanan sebelumnya tetap tersimpan."
                        action={() =>
                          update((s) => ({
                            ...s,
                            addresses: s.addresses.filter((x) => x.id !== a.id),
                          }))
                        }
                      >
                        <Button variant="ghost">Hapus</Button>
                      </Confirm>
                    </div>
                  </div>
                ))}
              </div>
              {!addresses.length && (
                <p className="muted">Belum ada alamat tersimpan.</p>
              )}
              <AddressEditor
                open={editing}
                onClose={() => setEditing(false)}
                address={address}
              />
            </>
          )}
          {section === "pengaturan" && (
            <>
              <form
                className="panel form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (!String(f.get("name") || "").trim()) {
                    toast.error("Nama tidak boleh kosong.");
                    return;
                  }
                  update((s) => ({
                    ...s,
                    profiles: s.profiles.map((p) =>
                      p.email === profile.email
                        ? {
                            ...p,
                            name: String(f.get("name")).trim(),
                            phone: String(f.get("phone")).trim(),
                          }
                        : p,
                    ),
                  }));
                  toast.success("Profil diperbarui.");
                }}
              >
                <h2>Profil pembaca</h2>
                <label>
                  Nama
                  <Input
                    name="name"
                    required
                    minLength={1}
                    maxLength={80}
                    defaultValue={profile.name}
                  />
                </label>
                <label>
                  Email
                  <Input value={profile.email} readOnly />
                </label>
                <label>
                  Telepon
                  <Input
                    name="phone"
                    defaultValue={profile.phone}
                    pattern="[+0-9 -]{9,16}"
                    placeholder="Opsional"
                  />
                </label>
                <Button type="submit">Simpan profil</Button>
              </form>
              <div className="panel">
                <h2>Sandi akun</h2>
                <p>Kami akan mengirim tautan pemulihan ke email akunmu.</p>
                <Go outline href="/lupa-sandi">
                  Atur ulang sandi
                </Go>
              </div>
            </>
          )}
          {section === "notifikasi" && (
            <div className="notifications">
              {orders.length ? (
                orders.flatMap((o) =>
                  o.history.map((h, i) => (
                    <Link
                      href={`/pesanan/${o.id}`}
                      key={`${o.id}-${i}`}
                      className="panel"
                    >
                      <Bell size={20} />
                      <div>
                        <strong>
                          {o.id}: {h.status}
                        </strong>
                        <p className="muted">
                          {new Date(h.date).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <ArrowRight size={16} />
                    </Link>
                  )),
                )
              ) : (
                <p className="muted">
                  Belum ada notifikasi. Perubahan status pesanan akan tampil di
                  sini.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
