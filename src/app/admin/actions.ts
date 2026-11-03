"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) redirect("/dashboard?error=admin-access");
  return supabase;
}

export async function reviewMerchant(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("merchant_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approved","rejected","suspended"].includes(status)) redirect("/admin?error=invalid");
  const { error } = await supabase.rpc("admin_review_merchant", { p_merchant_id: id, p_status: status });
  if (error) redirect("/admin?error=merchant");
  redirect("/admin?updated=merchant");
}

export async function reviewDriver(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["active","rejected","suspended"].includes(status)) redirect("/admin?error=invalid");
  const { error } = await supabase.rpc("admin_review_driver", { p_user_id: id, p_status: status });
  if (error) redirect("/admin?error=driver");
  redirect("/admin?updated=driver");
}

export async function saveServiceZone(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("zone_id") ?? "");
  const municipalityId = String(formData.get("municipality_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const fee = Number(formData.get("base_delivery_fee"));
  const active = formData.get("is_active") === "on";
  if ((id && !/^[0-9a-f-]{36}$/i.test(id)) || !/^[0-9a-f-]{36}$/i.test(municipalityId) || name.length < 2 || !Number.isFinite(fee) || fee < 0) redirect("/admin?error=zone");
  const { error } = await supabase.rpc("admin_save_service_zone", {
    p_zone_id: id || null, p_municipality_id: municipalityId, p_name: name,
    p_base_delivery_fee: fee, p_is_active: active,
  });
  if (error) redirect("/admin?error=zone");
  redirect("/admin?updated=zone");
}

export async function setMunicipalityServiceability(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("municipality_id") ?? "");
  const active = formData.get("is_serviceable") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin?error=area");
  const { error } = await supabase.rpc("admin_set_municipality_serviceable", { p_municipality_id: id, p_is_serviceable: active });
  if (error) redirect("/admin?error=area");
  redirect("/admin?updated=area");
}
