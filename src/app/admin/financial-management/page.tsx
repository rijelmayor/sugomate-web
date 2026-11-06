import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bike, FileText, Gift, Store, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PortalSignOut from "@/components/PortalSignOut";
import { saveFinancialSettings, createDriverBenefitProgram, setDriverBenefitProgramStatus } from "./actions";

const money=(v:number|string|null|undefined)=>"â‚±"+Number(v??0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const panel="rounded-2xl border border-white/10 bg-[#10243c] p-5";
const field="mt-2 w-full rounded-xl border border-white/10 bg-[#091827] px-3 py-3 text-sm text-white outline-none focus:border-orange-300";
export default async function FinancialManagementPage(){
 const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/login");
 const {data:role}=await db.from("user_roles").select("role").eq("user_id",user.id).eq("role","admin").maybeSingle(); if(!role) redirect("/dashboard?error=admin-access");
 const [settingsRes,programsRes,merchantRes,driverRes,statementsRes,payoutsRes]=await Promise.all([
  db.from("platform_financial_settings").select("*").eq("id",1).maybeSingle(),
  db.from("driver_benefit_programs").select("*").order("created_at",{ascending:false}).limit(100),
  db.from("merchant_system_usage_entries").select("system_usage_amount,status").limit(1000),
  db.from("driver_earnings_entries").select("net_delivery_earnings,status¶»§q«^