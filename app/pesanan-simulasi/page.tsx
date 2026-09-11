import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {SimulationOrders} from "@/components/store/simulation-checkout";
import {Shell} from "@/components/store/shared";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Pesanan Mode Tes | Fritzoria",robots:{index:false,follow:false}};
export default function Page(){if(process.env.VERCEL_ENV!=="preview")notFound();return <Shell><SimulationOrders/></Shell>;}
