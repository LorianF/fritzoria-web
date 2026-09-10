"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="wrap blank"><h1>Halaman belum dapat dimuat</h1><p>Periksa koneksi lalu coba lagi. Gangguan pemuatan bukan berarti buku telah dihapus.</p><button className="text-link" onClick={reset}>Coba lagi</button></div>;
}
