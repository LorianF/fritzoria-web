import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentTest } from "@/components/store/payment-test";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Simulasi Xendit | Fritzoria", robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  return <PaymentTest />;
}
