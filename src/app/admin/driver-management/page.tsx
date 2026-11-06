import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleDollarSign, Gift, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PortalSignOut from "@/components/PortalSignOut";

const statusTone=(status:string)=>status==="active"||status==="approved"?"border-emerald-300/20 bg-emerald-300/10 text-emerald-200":status==="pending"?"border-amber-300/20 bg-amber-300/10 text-amber-200":status==="suspended"||status==="rejected"?"border-rose-300/20 bg-rose-300/10 text-rose-200":"border-white/10 bg-white/[.04] text-slate-300";

export default async function DriverManagementPage() {
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const {data:role}=await supabase.from("user_roles").select("role").eq("user_id",user.id).eq("role","admin").maybeSingle();
 if(!role) redirect("/dashboard?error=admin-access");
 const {data}=await supabase.from("driver_profiles").select("user_id,status,vehicle_type,vehicle_plate,is_available,created_at").order("created_at",{ascending:false}).limit(250);
 const drivers=data??[];
 const ids=drivers.map(x=>x.user_id);
 const {data:profiles}=ids.length?await supabase.from("profiles").select("id,display_name,phone").in("id",ids):{data:[]};
 const profileMap=new Map((profiles??[]).map(x=>[x.id,x]));
 const active=drivers.filter(x=>x.status==="active");
 const online=active.filter(x=>x.is_available);
 return <main className="min-h-screen bg-[#071321] px-4 py-6 text-white sm:px-7 sm:py-8"><div className="mx-auto max-w-[1400px]">
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5"><div><Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold text-orange-200"><ArrowLeft size={14}/>Admin command center</Link><p className="mt-4 text-[9px] font-black uppercase tracking-[.2em] text-orange-300">Partner network / delivery</p><h1 className...[truncated]