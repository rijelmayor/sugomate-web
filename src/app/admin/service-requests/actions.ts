"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveAndDispatchServiceRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!admin) redirect("/dashboard?error=admin-access");

  const requestId = String(formData.get("request_id") ?? "");
  const driverId = String(formData.get("driver_user_id") ?? "");
  const purchaseBudget = Number(formData.get("approved_purchase_budget"));
  const deliveryFee = Number(formData.get("delivery_fee"));
  const serviceFee = Number(formData.get("service_fee"));
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !/^[0-9a-f-]{36}$/i.test(driverId) ||
      ![purchaseBudget, deliveryFee, serviceFee].every(Number.isFinite) ||
      [purchaseBudget, deliveryFee, serviceFee].some(v => v < 0)) {
    redirect("/admin/service-requests?error=details");
  }
  const { error } = await supabase.rpc("admin_approve_assign_service_request", {
    p_request_id: requestId,
    p_driver_user_id: driverId,
    p_approved_purchase_budget: purchaseBudget,
    p_delivery_fee: deliveryFee,
    p_service_fee: serviceFee,
  });
  if (error) {
    console.error("[service-request] admin dispatch failed:", error.message);
    redirect("/admin/service-requests?error=dispatch");
  }
  revalidatePath("/admin/service-requests");
  revalidatePath("/admin/dispatch");
  revalidatePath("/driver");
  redirect("/admin/service-requests?updated=1");
}


export async function cancelAdminServiceRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!admin) redirect("/dashboard?error=admin-access");
  const requestId = String(formData.get("request_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || reason.length < 3) redirect("/admin/service-requests?error=details");
  const { error } = await supabase.rpc("admin_cancel_service_request", { p_request_id: requestId, p_reason: reason });
  if (error) {
    console.error("[service-request] admin cancellation failed:", error.message);
    redirect("/admin/service-requests?error=cancel");
  }
  revalidatePath("/admin/service-requests");
  revalidatePath("/driver");
  redirect("/admin/service-requests?updated=cancelled");
}
