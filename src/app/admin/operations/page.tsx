import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalSignOut from "@/components/PortalSignOut";
import { reviewMerchant, reviewDriver, saveServiceZone, setMunicipalityServiceability } from "../actions";
import FormSubmitButton from "@/components/FormSubmitButton";

const money = (v: number | string) => "â‚±" + Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const orderLabels: Record<string, string> = { pending_merchant: "Awaiting store", accepted: "Accepted", preparing: "Preparing", ready_for_pickup: "Ready for pickup", assigned: "Driver assigned", picked_up: "Picked up", in_transit: "On the way", delivered: "Delivered", cancelled: "Cancelled", rejected: "Rejected" };
const statusTone = (status: string) => status === "approved" || status === "active" || status === "delivered" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : status === "pending" || status === "pending_merchant" || status === "preparing" ? "bg-amber-50 text-amber-800 ring-amber-100" : status === "rejected" || status === "cancelled" || status === "suspended" ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-slate-100 text-slate-600 ring-slate-200";

function SectionHeading({ kicker, title, detail, count }: { kicker: string; title: string; detail: string; count?: string }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px¶»§q«^