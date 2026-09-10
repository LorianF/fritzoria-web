'use client';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Ticket, MessageSquare, BookOpen } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useStore } from './provider';
import { Button, Input, Go, Grid, PageHead, Crumbs, Pick } from './shared';
const content: Record<string, {title:string;lead:string;sections:string[][]}> = {
  "tentang": {
    "title": "Tentang Fritzoria",
    "lead": "Temukan buku berikutnya dan pahami fitur yang tersedia.",
    "sections": [
      [
        "Buku untuk setiap pembaca",
        "Katalog mencakup novel, sastra, buku anak, manga, bisnis, agama, dan teknologi. Identitas buku merujuk pada sumber yang dicantumkan."
      ],
      [
        "Checkout saat ini",
        "Buku fisik tersedia melalui COD. Membuat pesanan menyimpan transaksi ke akun dan mencadangkan stok di database. Tidak ada pembayaran online; bayar saat barang diterima. Pengiriman ditangani toko, bukan integrasi kurir otomatis."
      ],
      [
        "Data akun dan perangkat",
        "Akun, profil, alamat, wishlist, katalog, dan pesanan tersimpan di Supabase. Keranjang, progres reader, bookmark, email minat, ulasan lokal, tiket contoh, dan konfigurasi banner/voucher lokal tetap tersimpan di browser ini."
      ],
      [
        "Bacaan digital",
        "Pembelian e-book dan preorder belum tersedia. Pride and Prejudice tersedia gratis melalui reader. Naskah komersial berhak cipta tidak disertakan."
      ]
    ]
  },
  "pengiriman": {
    "title": "Informasi pengiriman",
    "lead": "Biaya yang ditampilkan sebelum membuat pesanan COD.",
    "sections": [
      [
        "Buku fisik",
        "Reguler Rp18.000 atau ekspres Rp30.000. Pengiriman diatur toko; belum ada pelacakan atau estimasi otomatis dari kurir. Hubungi toko untuk memastikan jadwal."
      ],
      [
        "Gratis ongkir",
        "Gratis ongkir ketika subtotal buku mencapai Rp250.000. Voucher belum didukung. Total akhir ditampilkan sebelum pesanan dibuat."
      ],
      [
        "Alamat dan status",
        "Alamat tersimpan di akun. Salinan alamat pesanan tidak berubah ketika alamat akun diubah. Admin memproses dan menandai pengiriman; pembeli mengonfirmasi setelah barang diterima dan COD dibayar."
      ],
      [
        "Preorder",
        "Produk preorder belum bisa dimasukkan ke checkout COD. Tanggal yang ditampilkan hanya informasi pengelola."
      ]
    ]
  },
  "pembayaran": {
    "title": "Informasi pembayaran",
    "lead": "Bayar saat barang diterima (COD).",
    "sections": [
      [
        "Metode pembayaran",
        "Checkout hanya menyediakan COD untuk buku fisik. Virtual account, QRIS, e-wallet, dan checkout e-book belum tersedia."
      ],
      [
        "Harga dan voucher",
        "Harga serta ketersediaan diperiksa kembali di server saat checkout. Voucher belum dapat digunakan, termasuk kode contoh pada pengaturan lokal admin."
      ],
      [
        "Status pesanan",
        "Pesanan baru berstatus Menunggu pembayaran karena COD belum dibayar. Admin dapat memproses dan mengirim tanpa menandainya lunas. Status Selesai dikonfirmasi setelah penerimaan dan pembayaran COD."
      ],
      [
        "Pembatalan",
        "Pembeli dapat membatalkan sebelum pesanan diproses. Setelah diproses, pembatalan sebelum pengiriman memerlukan tindakan toko. Pembatalan mengembalikan stok sekali."
      ]
    ]
  },
  "pengembalian": {
    "title": "Pengembalian pesanan",
    "lead": "Ajukan melalui detail pesanan COD yang selesai.",
    "sections": [
      [
        "Pengajuan",
        "Isi alasan 10–1.000 karakter pada pesanan berstatus Selesai. Pengajuan berlaku untuk seluruh pesanan; retur sebagian belum tersedia."
      ],
      [
        "Pemeriksaan toko",
        "Admin dapat menolak pengajuan atau menerima setelah barang kembali. Penerimaan retur memulihkan stok. Pengembalian uang ditangani toko secara terpisah; aplikasi tidak melakukan transfer dana."
      ],
      [
        "Ketentuan",
        "Pastikan kesepakatan kondisi barang dan biaya pengembalian dengan toko. Perubahan status dicatat di riwayat pesanan."
      ]
    ]
  },
  "privasi": {
    "title": "Privasi & penyimpanan data",
    "lead": "Bedakan data akun dan data yang hanya tersimpan di browser.",
    "sections": [
      [
        "Data akun",
        "Autentikasi ditangani Supabase. Profil, alamat, wishlist, dan pesanan disimpan di server dengan pembatasan akses. Admin berwenang dapat melihat pelanggan dan pesanan untuk pemenuhan."
      ],
      [
        "Data perangkat",
        "Browser menyimpan sesi masuk, keranjang, cache akun, progres baca, bookmark, email minat, ulasan lokal, tiket contoh, dan konfigurasi banner/voucher lokal. Jangan memakai browser bersama tanpa keluar dan membersihkan data situs."
      ],
      [
        "Pihak ketiga",
        "Supabase menyimpan data akun dan katalog. Hosting serta aset buku dapat dimuat dari layanan terkait. Tautan sumber membuka situs pihak ketiga dengan kebijakan masing-masing."
      ],
      [
        "Menghapus data",
        "Menghapus data situs membersihkan data perangkat dan sesi masuk, tetapi tidak menghapus akun atau pesanan di server. Penghapusan data server harus diminta kepada pengelola."
      ]
    ]
  },
  "syarat": {
    "title": "Syarat penggunaan",
    "lead": "Fitur transaksi yang tersedia saat ini.",
    "sections": [
      [
        "Penggunaan",
        "Periksa item, alamat, total, dan persetujuan COD sebelum memesan. Tombol Buat pesanan COD menyimpan pesanan dan mencadangkan stok; ini bukan tombol simulasi lokal."
      ],
      [
        "Katalog",
        "Informasi edisi mengacu pada sumber. Metadata yang belum terverifikasi diberi keterangan. Harga dan stok dikelola toko dan diperiksa kembali pada checkout."
      ],
      [
        "Konten",
        "Hanya unggah konten yang berhak digunakan. Bacaan klasik gratis tidak berarti buku komersial lain tersedia tanpa izin."
      ],
      [
        "Batas fungsi",
        "Pembayaran online, pembelian e-book, preorder, dan voucher belum tersedia. Tiket contoh, ulasan, banner, dan voucher lokal belum tersinkron lintas perangkat atau dikirim ke layanan pelanggan."
      ]
    ]
  }
};
const faqs = [
  [
    "Bagaimana memesan buku?",
    "Pilih buku fisik yang tersedia, masuk, pilih alamat, periksa total, lalu buat pesanan COD. Pesanan disimpan di server dan stok dicadangkan. Bayar saat diterima."
  ],
  [
    "Mengapa data tersimpan setelah refresh?",
    "Akun dan pesanan tersimpan di Supabase. Keranjang serta progres reader tersimpan di browser. Tiket contoh, ulasan, banner, dan voucher lokal belum tersinkron lintas perangkat."
  ],
  [
    "Mengapa e-book tidak bisa dibeli?",
    "Checkout digital belum tersedia. Tombol pembelian e-book dinonaktifkan. Reader Pride and Prejudice tetap tersedia gratis."
  ],
  [
    "Bagaimana memakai voucher?",
    "Voucher belum didukung checkout COD. Kode contoh di admin lokal tidak dapat digunakan untuk pesanan."
  ],
  [
    "Bagaimana melanjutkan status pengiriman?",
    "Admin membuka Pesanan → Kelola, memproses COD lalu menandainya dikirim. Setelah barang diterima dan dibayar, pembeli dapat mengonfirmasi penyelesaian."
  ],
  [
    "Bagaimana membatalkan atau mengajukan retur?",
    "Batalkan melalui detail pesanan sebelum diproses. Untuk retur, gunakan formulir pada pesanan Selesai. Pengembalian dana diatur toko secara terpisah."
  ],
  [
    "Apakah semua buku memiliki ISBN dan informasi halaman?",
    "Tidak semua sumber menyediakan metadata lengkap. Lihat keterangan dan tautan sumber pada detail buku."
  ]
];
export function Info({ page }: {
    page: string;
}) { const data = content[page]; if (!data)
    return null; return <div className="wrap"><Crumbs items={[[data.title, ""]]}/><div className="info-layout"><aside><h3>Informasi Fritzoria</h3>{Object.entries(content).map(([s, p]) => <Link className={s === page ? 'active' : ''} key={s} href={`/${s}`}>{p.title}</Link>)}<Link href="/kontak">Hubungi kami</Link></aside><article><PageHead title={data.title} description={data.lead}/>{data.sections.map(([h, p]) => <section key={h}><h2>{h}</h2><p>{p}</p></section>)}</article></div></div>; }
export function Help() { return <div className="wrap narrow"><Crumbs items={[["Bantuan", ""]]}/><PageHead title="Ada yang ingin ditanyakan?" eyebrow="PUSAT BANTUAN" description="Panduan singkat untuk menjelajahi Fritzoria."/><Accordion type="single" collapsible>{faqs.map(([q, a], i) => <AccordionItem value={String(i)} key={q}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>)}</Accordion><div className="help-links"><Go href="/kontak">Tulis pertanyaan <MessageSquare size={16}/></Go><Go href="/pengiriman" outline>Informasi pengiriman</Go></div></div>; }
export function Contact() { const { state, update } = useStore(); const [topic, setTopic] = useState('Pesanan'); const [sent, setSent] = useState(''); return <div className="wrap narrow"><Crumbs items={[["Bantuan", "/bantuan"], ["Kontak", ""]]}/><PageHead title="Hubungi Fritzoria" eyebrow="KAMI MENDENGARKAN" description="Formulir ini menyimpan tiket di admin demo lokal. Pesan tidak dikirim ke pihak lain."/>{sent && <div className="notice" role="status">Tiket {sent} tersimpan. Kamu dapat melihatnya di Admin demo → Pesan bantuan.</div>}<form className="panel form-stack" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); const id = 'HELP-' + Date.now().toString(36).toUpperCase(); update(s => ({ ...s, tickets: [{ id, name: String(fd.get('name')).trim(), email: String(fd.get('email')).trim(), topic, message: String(fd.get('message')).trim(), status: 'Baru' }, ...s.tickets] })); setSent(id); form.reset(); toast.success('Pesan disimpan ke admin lokal.'); }}><label>Nama<Input required name="name" maxLength={80}/></label><label>Email<Input required type="email" name="email"/></label><label>Topik<Pick label="Topik bantuan" value={topic} onChange={setTopic} options={['Pesanan', 'Pembayaran', 'E-book', 'Katalog', 'Kerja sama penerbit', 'Lainnya'].map(x => [x, x])}/></label><label>Pesan<textarea required name="message" minLength={10} maxLength={2000} placeholder="Ceritakan pertanyaan atau kendalamu"/></label><Button type="submit">Simpan tiket bantuan <ArrowRight size={16}/></Button></form></div>; }
export function Promos() { const { books } = useStore(); return <div className="wrap"><Crumbs items={[["Promo", ""]]}/><PageHead title="Harga pilihan hari ini" eyebrow="PROMO FRITZORIA" description="Harga katalog terbaru. Voucher belum tersedia untuk checkout COD."/><p className="notice">Kode voucher contoh belum dapat digunakan. Total checkout menggunakan harga buku dan ongkir yang ditampilkan.</p><Grid books={books.filter(b => !b.hidden && b.originalPrice > b.price).slice(0,12)}/></div>; }
export function Sources() { const { books } = useStore(); const visibleBooks = books.filter(b => !b.hidden); return <div className="wrap"><Crumbs items={[["Sumber katalog", ""]]}/><PageHead title="Sumber & identitas buku" eyebrow="KATALOG YANG DAPAT DITELUSURI" description={`Katalog saat ini: ${visibleBooks.length} buku. Metadata mengacu pada sumber; harga dan stok dikelola toko.`}/><p className="notice">Halaman sumber Cantik Itu Luka memuat detail edisi yang tidak seragam dengan sampul. ISBN dan jumlah halamannya sengaja tidak ditampilkan sampai edisi dipastikan. Metadata yang tidak tersedia di sumber tidak diisi dengan angka rekaan.</p><div className="source-list">{visibleBooks.map(b => <div key={b.slug}><Link href={`/buku/${b.slug}`}><strong>{b.title}</strong><small>{b.author}</small></Link><span>{b.isbn || 'ISBN belum terverifikasi'}</span><a href={b.source} target="_blank" rel="noreferrer">Sumber buku ↗</a></div>)}</div><p className="muted">Bacaan klasik: <a className="text-link" href="https://www.gutenberg.org/ebooks/1342" target="_blank" rel="noreferrer">Pride and Prejudice — Project Gutenberg</a>. File unduhan menyertakan teks sumber dan lisensinya.</p></div>; }
