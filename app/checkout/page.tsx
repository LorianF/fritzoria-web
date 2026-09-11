import type {Metadata} from "next";
import {Checkout} from "@/components/store/checkout";
import {Shell} from "@/components/store/shared";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Checkout | Fritzoria"};
export default function Page(){return <Shell><Checkout testEnabled={process.env.VERCEL_ENV==="preview"}/></Shell>;}
