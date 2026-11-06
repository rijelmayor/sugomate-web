"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(){
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user) redirect("/login");
 const {data:role}=await db.from("user_roles").select("role").eq("user_id",user.id).eq("role","admin").maybeSingle();
 if(!role) redirect("/dashboard?error=admin-access");
 return {db,user};
}

export async function saveFinancialSettings(formData:FormData){
 const {db,user}=await requireAdmin();
 const scope=String(formData.get("scope")??"");
 const method=String(formData.get("method")??"");
 const value=Number(formData.get("value"));
 const enabled=formData.get("enabled")==="on";
 if(!["merchant","delivery"].includes(scope)||!["percentage","fixed"].includes(method)||!Number.isFinite(value)||value<0||value>(scope==="delivery"?100:1000)) redirect("/admin/financial-management?error=invalid");
 if(scope==="delivery"&&method==="fixed"&&enabled){
  const {data:zones,error:zoneError}=await db.from("service_zones").select("base_delivery_fee").eq("is_active",true);
  if(zoneError) redirect("/admin/financial-management?error=zone-validation");
  if(zones?.length&&value>Math.min(...zones.map(z=>Number(z.base_delivery_fee||0)))) redirect("/admin/financial-management?error=exceeds-base-rate");
 }
 const patch=scope==="merchant"
  ?{merchant_usage_enabled:enabled,merchant_usage_method:method,merc¶»§q«^