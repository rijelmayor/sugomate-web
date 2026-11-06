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
  ?{merchant_usage_enabled:enabled,merchant_usage_method:method,merchant_usage_value:value}
  :{delivery_usage_enabled:enabled,delivery_usage_method:method,delivery_usage_value:value};
 const {error}=await db.from("platform_financial_settings").upsert({id:1,...patch,updated_at:new Date().toISOString(),updated_by:user.id},{onConflict:"id"});
 if(error) redirect("/admin/financial-management?error=save");
 revalidatePath("/admin/financial-management");
 redirect("/admin/financial-management?saved=1");
}

export async function createDriverBenefitProgram(formData:FormData){
 const {db,user}=await requireAdmin();
 const name=String(formData.get("name")??"").trim().slice(0,100);
 const description=String(formData.get("description")??"").trim().slice(0,500);
 const benefit_type=String(formData.get("benefit_type")??"");
 const calculation_method=String(formData.get("calculation_method")??"fixed");
 const amount=Number(formData.get("amount"));
 const rawStart=String(formData.get("starts_at")??"").trim();
 const rawEnd=String(formData.get("ends_at")??"").trim();
 if(rawStart&&rawEnd&&rawEnd<rawStart) redirect("/admin/financial-management?error=date-range");
 if(name.length<2||!["bonus","incentive","allowance","referral","other"].includes(benefit_type)||!["fixed","percentage"].includes(calculation_method)||!Number.isFinite(amount)||amount<0) redirect("/admin/financial-management?error=invalid-program");
 const {error}=await db.from("driver_benefit_programs").insert({
  name,description:description||null,benefit_type,calculation_method,amount,is_active:false,
  starts_at:rawStart?new Date(rawStart+":00+08:00").toISOString():null,
  ends_at:rawEnd?new Date(rawEnd+":00+08:00").toISOString():null,
  created_by:user.id
 });
 if(error) redirect("/admin/financial-management?error=program-save");
 revalidatePath("/admin/financial-management");
 redirect("/admin/financial-management?program=saved");
}

export async function setDriverBenefitProgramStatus(formData:FormData){
 const {db}=await requireAdmin();
 const id=String(formData.get("id")??"");
 const active=String(formData.get("active")??"false")==="true";
 if(!id) redirect("/admin/financial-management?error=program-id");
 const {error}=await db.from("driver_benefit_programs").update({is_active:active,updated_at:new Date().toISOString()}).eq("id",id);
 if(error) redirect("/admin/financial-management?error=program-update");
 revalidatePath("/admin/financial-management");
 redirect("/admin/financial-management?program=updated");
}


export async function createMerchantBillingStatement(formData:FormData){
 const {db}=await requireAdmin();
 const merchantId=String(formData.get("merchant_id")??"");
 const periodStart=String(formData.get("period_start")??"");
 const periodEnd=String(formData.get("period_end")??"");
 const note=String(formData.get("admin_note")??"").trim().slice(0,500);
 if(!/^[0-9a-f-]{36}$/i.test(merchantId)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(periodStart)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(periodEnd)||periodEnd<periodStart){
  redirect("/admin/financial-management?error=billing-period");
 }
 const {error}=await db.rpc("admin_create_merchant_billing_statement",{
  p_merchant_id:merchantId,p_period_start:periodStart,p_period_end:periodEnd,p_admin_note:note||null
 });
 if(error) redirect("/admin/financial-management?error=billing-create");
 revalidatePath("/admin/financial-management");
 redirect("/admin/financial-management?billing=issued");
}

export async function reviewDriverPayout(formData:FormData){
 const {db}=await requireAdmin();
 const requestId=String(formData.get("request_id")??"");
 const nextStatus=String(formData.get("next_status")??"");
 const reference=String(formData.get("payment_reference")??"").trim().slice(0,120);
 const note=String(formData.get("admin_note")??"").trim().slice(0,500);
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||!["approved","rejected","paid"].includes(nextStatus)){
  redirect("/admin/financial-management?error=payout-action");
 }
 if(nextStatus==="paid"&&!reference) redirect("/admin/financial-management?error=payout-reference");
 const {error}=await db.rpc("admin_review_driver_payout",{
  p_request_id:requestId,p_next_status:nextStatus,
  p_payment_reference:reference||null,p_admin_note:note||null
 });
 if(error) redirect("/admin/financial-management?error=payout-review");
 revalidatePath("/admin/financial-management");
 redirect("/admin/financial-management?payout=updated");
}
