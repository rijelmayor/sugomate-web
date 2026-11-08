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


export async function assignOrderToDriver(formData: FormData) {
  const supabase = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const driverUserId = String(formData.get("driver_user_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(driverUserId)) {
    redirect("/admin/dispatch?error=invalid");
  }
  const { error } = await supabase.rpc("admin_assign_order_to_driver", {
    p_order_id: orderId,
    p_driver_user_id: driverUserId,
  });
  if (error) redirect("/admin/dispatch?error=assignment");
  redirect("/admin/dispatch?updated=assigned");
}


export async function saveDeliveryRoute(formData: FormData) {
  const supabase = await requireAdmin();
  const origin = String(formData.get("origin_municipality_id") ?? "");
  const destination = String(formData.get("destination_municipality_id") ?? "");
  const fee = Number(formData.get("delivery_fee"));
  const active = formData.get("is_active") === "on";
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  if (!/^[0-9a-f-]{36}$/i.test(origin) || !/^[0-9a-f-]{36}$/i.test(destination) || !Number.isFinite(fee) || fee < 0) redirect("/admin/localities?error=route");
  const { error } = await supabase.from("delivery_routes").upsert({
    origin_municipality_id: origin, destination_municipality_id: destination,
    delivery_fee: fee, is_active: active, notes: notes || null, updated_at: new Date().toISOString(),
  }, { onConflict: "origin_municipality_id,destination_municipality_id" });
  if (error) redirect("/admin/localities?error=route");
  redirect("/admin/localities?saved=route");
}

export async function authorizeRiderLocality(formData: FormData) {
  const supabase = await requireAdmin();
  const rider = String(formData.get("rider_user_id") ?? "");
  const municipality = String(formData.get("municipality_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const expiryRaw = String(formData.get("expires_at") ?? "");
  const expiry = expiryRaw ? new Date(expiryRaw).toISOString() : null;
  if (!/^[0-9a-f-]{36}$/i.test(rider) || !/^[0-9a-f-]{36}$/i.test(municipality) || reason.length < 3 || (expiry && !Number.isFinite(Date.parse(expiry)))) redirect("/admin/localities?error=authorization");
  const { error } = await supabase.rpc("admin_authorize_rider_locality", {
    p_rider_user_id: rider, p_municipality_id: municipality, p_reason: reason, p_expires_at: expiry,
  });
  if (error) redirect("/admin/localities?error=authorization");
  redirect("/admin/localities?saved=authorization");
}

export async function revokeRiderLocality(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("authorization_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!/^[0-9a-f-]{36}$/i.test(id) || reason.length < 3) redirect("/admin/localities?error=authorization");
  const { error } = await supabase.rpc("admin_revoke_rider_locality", { p_authorization_id: id, p_reason: reason });
  if (error) redirect("/admin/localities?error=authorization");
  redirect("/admin/localities?saved=revoked");
}
