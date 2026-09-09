import type { Order, Address, Line } from "../store/types";
import { getSupabaseBrowserClient } from "./client";

type Row = {
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
export async function loadOrders(): Promise<Order[]> {
  const db = getSupabaseBrowserClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError) throw authError;
  if (!user?.email) return [];
  const { data, error } = await db
    .from("orders")
    .select("*,order_items(*),order_status_history(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map((r) => {
    const a = r.address_snapshot;
    const address: Address | undefined = a
      ? {
          id: a.id,
          email: user.email!,
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
      email: user.email!,
      name: String(user.user_metadata?.name || user.email),
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
    };
  });
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
