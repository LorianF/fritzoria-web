"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Headphones,
  Inbox,
  MessageCircle,
  Plus,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useStore } from "./provider";
import { Button, Go, Input, Pick } from "./shared";
import {
  loadSupportMessages,
  loadSupportThreads,
  sendSupportMessage,
  startSupportThread,
  subscribeSupport,
  supportError,
  updateSupportStatus,
  type SupportMessage,
  type SupportStatus,
  type SupportThread,
} from "@/lib/supabase/support";

const topics = ["Pesanan", "Pembayaran", "Pengiriman", "Retur", "Akun", "Katalog", "Lainnya"];
const statusText: Record<SupportStatus, string> = {
  open: "Menunggu CS",
  waiting_customer: "Menunggu balasan Anda",
  resolved: "Selesai",
};

function SupportDesk({ compact = false, admin = false }: { compact?: boolean; admin?: boolean }) {
  const { state } = useStore();
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState("Pesanan");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const signedIn = Boolean(state.session);
  const selected = threads.find((thread) => thread.id === selectedId);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const next = await loadSupportThreads();
      setThreads(next);
      setError("");
    } catch (cause) {
      setError(supportError(cause));
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  const refreshMessages = useCallback(async () => {
    if (!selectedId) return;
    try {
      setMessages(await loadSupportMessages(selectedId));
      setError("");
    } catch (cause) {
      setError(supportError(cause));
    }
  }, [selectedId]);

  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeSupport(() => {
      void refresh();
      void refreshMessages();
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [signedIn, refresh, refreshMessages]);

  async function openThread(id: string) {
    setSelectedId(id);
    setError("");
    try {
      setMessages(await loadSupportMessages(id));
    } catch (cause) {
      setError(supportError(cause));
    }
  }

  async function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const id = await startSupportThread(topic, String(data.get("subject") || ""), String(data.get("body") || ""));
      form.reset();
      await refresh();
      await openThread(id);
      setCreating(false);
      toast.success("Percakapan CS dibuat.");
    } catch (cause) {
      setError(supportError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await sendSupportMessage(selectedId, String(data.get("reply") || ""));
      form.reset();
      await Promise.all([refresh(), refreshMessages()]);
    } catch (cause) {
      setError(supportError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: SupportStatus) {
    if (!selected) return;
    setBusy(true);
    try {
      await updateSupportStatus(selected.id, status);
      await refresh();
    } catch (cause) {
      setError(supportError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="support-signin">
        <Headphones size={28} />
        <h3>Chat dengan CS Fritzoria</h3>
        <p>Masuk agar pertanyaan, komplain, dan balasan CS tersimpan aman di akun Anda.</p>
        <Go href="/masuk?next=/kontak">Masuk untuk mulai chat</Go>
        <Go href="/bantuan" outline>Lihat pusat bantuan</Go>
      </div>
    );
  }

  if (loading) {
    return <div className="support-loading" role="status"><span /><span /><span /> Memuat percakapan…</div>;
  }

  if (creating) {
    return (
      <form className="support-new-form" onSubmit={createThread}>
        <button type="button" className="support-back" onClick={() => setCreating(false)}><ArrowLeft size={16} /> Percakapan</button>
        <h3>Ceritakan yang bisa kami bantu</h3>
        <label>Topik<Pick label="Topik bantuan" value={topic} onChange={setTopic} options={topics.map((value) => [value, value])} /></label>
        <label>Subjek<Input name="subject" required minLength={3} maxLength={120} placeholder="Contoh: status pesanan belum berubah" /></label>
        <label>Pesan<textarea name="body" required minLength={1} maxLength={2000} placeholder="Tuliskan detail pertanyaan atau komplain Anda" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Mengirim…" : "Mulai percakapan"} <Send size={15} /></Button>
      </form>
    );
  }

  if (selected) {
    return (
      <div className="support-conversation">
        <div className="support-conversation-head">
          <button type="button" className="support-back" onClick={() => setSelectedId("")}><ArrowLeft size={16} /> Semua</button>
          <div><strong>{selected.subject}</strong><small>{selected.topic} · {statusText[selected.status]}</small></div>
        </div>
        <div className="support-messages" aria-live="polite">
          {messages.map((item) => (
            <article className={`support-message ${item.sender_role}`} key={item.id}>
              <small>{item.sender_role === "admin" ? "CS Fritzoria" : admin ? selected.profiles?.name || "Pelanggan" : "Anda"}</small>
              <p>{item.body}</p>
              <time>{new Date(item.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</time>
            </article>
          ))}
          {!messages.length && <p className="muted">Belum ada pesan dalam percakapan ini.</p>}
        </div>
        <form className="support-reply" onSubmit={reply}>
          <textarea name="reply" aria-label="Balasan" required minLength={1} maxLength={2000} placeholder={admin ? "Tulis balasan sebagai CS…" : "Tulis balasan…"} />
          <Button type="submit" disabled={busy}>{busy ? "Mengirim…" : "Kirim"} <Send size={15} /></Button>
        </form>
        <div className="support-status-actions">
          {selected.status !== "resolved" ? (
            <Button variant="outline" disabled={busy} onClick={() => void setStatus("resolved")}><CheckCircle2 size={15} /> Tandai selesai</Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => void setStatus("open")}><Clock3 size={15} /> Buka kembali</Button>
          )}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="support-list-view">
      <div className="support-list-head">
        <div><p className="eyebrow">{admin ? "INBOX CS" : "LAYANAN PELANGGAN"}</p><h3>{admin ? "Percakapan pelanggan" : "Ada yang bisa kami bantu?"}</h3></div>
        {!admin && <Button onClick={() => setCreating(true)}><Plus size={16} /> Chat baru</Button>}
      </div>
      {threads.length ? (
        <div className="support-thread-list">
          {threads.map((thread) => (
            <button type="button" key={thread.id} onClick={() => void openThread(thread.id)}>
              <span className={`support-status ${thread.status}`}><MessageCircle size={15} /></span>
              <span><strong>{thread.subject}</strong><small>{admin && thread.profiles ? `${thread.profiles.name} · ` : ""}{thread.topic} · {statusText[thread.status]}</small></span>
              <time>{new Date(thread.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</time>
            </button>
          ))}
        </div>
      ) : (
        <div className="support-empty"><Inbox size={29} /><strong>{admin ? "Inbox masih kosong" : "Belum ada percakapan"}</strong><p>{admin ? "Pesan pelanggan akan muncul di sini." : "Mulai chat untuk bertanya tentang buku, pesanan, pembayaran, pengiriman, atau retur."}</p>{!admin && <Button onClick={() => setCreating(true)}>Mulai chat dengan CS</Button>}</div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!compact && !admin && <p className="support-hours"><Clock3 size={15} /> Balasan ditangani melalui Studio admin. Waktu respons bergantung pada ketersediaan pengelola.</p>}
    </div>
  );
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (path.startsWith("/admin") || path === "/kontak") return null;
  return (
    <div className={`support-widget${open ? " open" : ""}`}>
      {open && (
        <section className="support-widget-panel" aria-label="Chat layanan pelanggan">
          <header><span><Headphones size={19} /><strong>CS Fritzoria</strong></span><button aria-label="Tutup chat" onClick={() => setOpen(false)}><X size={19} /></button></header>
          <SupportDesk compact />
        </section>
      )}
      <button className="support-launcher" aria-label={open ? "Tutup chat CS" : "Buka chat CS"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <X size={21} /> : <MessageCircle size={21} />}
        <span>{open ? "Tutup" : "Butuh bantuan?"}</span>
      </button>
    </div>
  );
}

export function CustomerSupport() {
  return <div className="support-page-desk"><SupportDesk /></div>;
}

export function AdminSupport() {
  return <div className="panel admin-support"><SupportDesk admin /></div>;
}
