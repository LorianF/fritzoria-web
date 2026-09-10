import type { Order, Address, Line } from "../store/types";
import { getSupabaseBrowserClient } from "./client";

type Row = {
  profiles: { email: string; name: string };
  return_reason: string;
  order_number: string;
  created_at: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  courier: string;
  payment_method: string;
  status: Order["status"];
  customer_note: string;
  address_snapshot: {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    city: string;
    province: string;
    postal_code: string;
    street: string;
    is_primary: boolean;
  };
  order_items: {
    slug: string;
    title: string;
    author: string;
    cover_url: string;
    format: "fisik" | "ebook";
    quantity: number;
    unit_price: number;
  }[];
  order_status_history: { status: string; created_at: string }[];
};
export async function loadOrders(admin = false): Promise<Order[]> {
  const db = getSupabaseBrowserClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError) throw authError;
  if (!user?.email) return [];
  let query = db
    .from("orders")
    .select("*,profiles!orders_user_id_fkey(email,name),order_items(*),order_status_history(*)");
  // RLS remains authoritative even if a caller passes admin=true.
  if (!admin) query = query.eq("user_id", user.id);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map((r) => {
    const a = r.address_snapshot;
    const address: Address | undefined = a
      ? {
          id: a.id,
          email: r.profiles.email,
          label: a.label,
          name: a.recipient_name,
          phone: a.phone,
          city: a.city,
          province: a.province,
          postal: a.postal_code,
          street: a.street,
          primary: a.is_primary,
        }
      : undefined;
    return {
      id: r.order_number,
      email: r.profiles.email,
      name: r.profiles.name || r.profiles.email,
      date: r.created_at,
      lines: r.order_items.map((l) => ({
        slug: l.slug,
        title: l.title,
        author: l.author,
        cover: l.cover_url,
        format: l.format,
        qty: l.quantity,
        price: l.unit_price,
      })),
      subtotal: r.subtotal,
      discount: r.discount,
      shipping: r.shipping,
      total: r.total,
      courier: r.courier,
      method: r.payment_method,
      address,
      status: r.status,
      history: r.order_status_history
        .map((h) => ({ status: h.status, date: h.created_at }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      note: r.customer_note,
      voucher: "",
      returnReason: r.return_reason || undefined,
    };
  });
}
export async function transitionCodOrder(id: string, expected: Order["status"], status: Order["status"], reason = "") {
  const { error } = await getSupabaseBrowserClient().rpc("transition_cod_order", {
    p_number: id, p_expected: expected, p_status: status, p_reason: reason,
  });
  if (error) throw new Error(error.code === "PGRST202"
    ? "Pengelolaan COD belum diaktifkan. Jalankan migrasi QA di Supabase."
    : error.message);
}
export async function createOrder(input: {
  key: string;
  addressId: string;
  lines: Line[];
  courier: string;
  note: string;
  total: number;
}) {
  const { data, error } = await getSupabaseBrowserClient().rpc(
    "create_cod_order",
    {
      p_key: input.key,
      p_address: input.addressId,
      p_lines: input.lines,
      p_courier: input.courier,
      p_note: input.note,
      p_expected_total: input.total,
    },
  );
  if (error) {
    if (error.code === "PGRST202")
      throw Error(
        "Checkout belum diaktifkan. Jalankan migrasi checkout di Supabase.",
      );
    throw Error(error.message);
  }
  if (typeof data !== "string")
    throw Error(
      "Nomor pesanan belum diterima. Coba lagi dengan keranjang yang sama.",
    );
  return data;
}
