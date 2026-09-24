import { getSupabaseBrowserClient } from "./client";

export type SupportStatus = "open" | "waiting_customer" | "resolved";
export type SupportMessage = {
  id: number;
  thread_id: string;
  sender_id: string;
  sender_role: "customer" | "admin";
  body: string;
  created_at: string;
};
export type SupportThread = {
  id: string;
  user_id: string;
  topic: string;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  profiles?: { name: string; email: string } | null;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : "Layanan CS belum dapat dihubungi.";
}

export async function loadSupportThreads() {
  const { data, error } = await getSupabaseBrowserClient()
    .from("support_threads")
    .select("*, profiles(name,email)")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as SupportThread[];
}

export async function loadSupportMessages(threadId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("support_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data || []) as SupportMessage[];
}

export async function startSupportThread(topic: string, subject: string, body: string) {
  const { data, error } = await getSupabaseBrowserClient().rpc("start_support_thread", {
    p_topic: topic,
    p_subject: subject,
    p_body: body,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function sendSupportMessage(threadId: string, body: string) {
  const { error } = await getSupabaseBrowserClient().rpc("send_support_message", {
    p_thread: threadId,
    p_body: body,
  });
  if (error) throw new Error(error.message);
}

export async function updateSupportStatus(threadId: string, status: SupportStatus) {
  const { error } = await getSupabaseBrowserClient()
    .from("support_threads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", threadId);
  if (error) throw new Error(error.message);
}

export function subscribeSupport(onChange: () => void) {
  const client = getSupabaseBrowserClient();
  const channel = client
    .channel(`support-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function supportError(error: unknown) {
  const value = message(error);
  if (/relation .* does not exist|schema cache/i.test(value)) {
    return "Layanan CS sedang disiapkan. Coba kembali beberapa saat lagi.";
  }
  return value;
}
