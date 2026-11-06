import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowUpRight, Bike, Boxes, ChartNoAxesCombined, CircleDollarSign, ClipboardCheck, Gauge, MapPinned, PackageCheck, ShieldCheck, Store, Users, Wallet, Zap, Truck, Clock3, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PortalSignOut from "@/components/PortalSignOut";

const money = (value: number | string) => "â‚±" + Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusStyles: Record<string,string> = {
  delivered:"border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  cancelled:"border-rose-400/20 bg-rose-400/10 text-rose-300",
  rejected:"border-rose-400/20 bg-rose-400/10 text-rose-300",
  pending_merchant:"border-amber-400/20 bg-amber-400/10 text-amber-200",
  preparing:"border-sky-400/20 bg-sky-400/10 text-sky-200",
  ready_for_pickup:"border-orange-400/20 bg-orange-400/10 text-orange-200",
  assigned:"border-violet-400/20 bg-violet-400/10 text-violet-200",
};

function Metric({label,value,detail,icon:Icon,tone="orange"}:{label:string;value:string|number;detail:string;icon:React.ComponentType<{size?:number}>;tone?:string}) {
  const tones:Record<string,string>={orange:"from-orange-400/20 to-orange-500/5 text-orange-300 ring-orange-300/15",cyan:"from-cyan-400/20 to-cyan-500/5 text-cyan-300 ring-cyan-300/15",violet:"from-violet-400/20 to-violet-500/5 text-violet-300 ring-viol¶»§q«^