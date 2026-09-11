export type SimulationLine = { slug: string; title: string; quantity: number; unit_price: number };
export type SimulationBook = { slug: string; title: string; physical_price: number; hidden: boolean; preorder: boolean; stock: number };

export function parseSimulationLines(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error("Keranjang harus berisi 1–50 buku fisik.");
  const seen = new Set<string>();
  return value.map(line => {
    if (!line || typeof line.slug !== "string" || !/^[a-z0-9-]{1,180}$/.test(line.slug) || line.format !== "fisik" || !Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > 99 || seen.has(line.slug)) {
      throw new Error("Isi keranjang simulasi tidak valid.");
    }
    seen.add(line.slug);
    return { slug: line.slug as string, qty: line.qty as number };
  });
}

export function simulationQuote(lines: ReturnType<typeof parseSimulationLines>, books: SimulationBook[], courier: string) {
  if (!["Reguler", "Ekspres"].includes(courier)) throw new Error("Pilih kurir yang tersedia.");
  const items: SimulationLine[] = lines.map(line => {
    const book = books.find(b => b.slug === line.slug);
    if (!book || book.hidden || book.preorder || book.stock < line.qty || !Number.isSafeInteger(book.physical_price) || book.physical_price <= 0) throw new Error("Buku atau stok tidak tersedia. Muat ulang keranjang.");
    return { slug: book.slug, title: book.title, quantity: line.qty, unit_price: book.physical_price };
  });
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const shipping = subtotal >= 250000 ? 0 : courier === "Ekspres" ? 30000 : 18000;
  const total = subtotal + shipping;
  if (!Number.isSafeInteger(total) || total > 10000000) throw new Error("Nominal simulasi melebihi batas Rp10.000.000.");
  return { items, subtotal, shipping, total };
}
