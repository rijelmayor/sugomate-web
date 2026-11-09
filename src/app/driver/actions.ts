"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function dispatchCompletedOrderReceiptWorker() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!siteUrl || !secret) return;
  try {
    const response = await fetch(new URL("/api/cron/order-completion-receipts", siteUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error("[order-receipt] worker dispatch returned", response.status);
  } catch (error) {
    console.error("[order-receipt] immediate dispatch failed; queued retry remains available", error);
  }
}

async function requireActiveDriver() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/driver");
  const { data: profile } = await supabase.from("driver_profiles")
    .select("status").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/driver/apply");
  return { supabase, user };
}


export async function updateDriverProfilePhoto(formData: FormData) {
  const { supabase, user } = await requireActiveDriver();
  const file = formData.get("profile_photo");
  if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    redirect("/driver?error=photo");
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/profile-${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("driver-documents").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (uploadError) redirect("/driver?error=photo");

  const { data: previous } = await supabase.from("driver_profiles")
    .select("profile_photo_path").eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.rpc("driver_update_profile_photo", { p_profile_photo_path: path });
  if (error) {
    await supabase.storage.from("driver-documents").remove([path]);
    redirect("/driver?error=photo");
  }
  if (previous?.profile_photo_path && previous.profile_photo_path !== path) {
    await supabase.storage.from("driver-documents").remove([previous.profile_photo_path]);
  }
  revalidatePath("/driver");
  redirect("/driver?updated=photo");
}

export async function setDriverAvailability(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const available = String(formData.get("is_available")) === "true";
  const { error } = await supabase.rpc("driver_set_availability", { p_is_available: available });
  if (error) redirect("/driver?error=availability");
  revalidatePath("/driver");
}

export async function claimReadyOrder(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/driver?error=claim");
  const { error } = await supabase.rpc("driver_claim_order", { p_order_id: orderId });
  if (error) redirect("/driver?error=claim");
  revalidatePath("/driver");
}

export async function respondToDriverAssignment(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  const accept = String(formData.get("accept")) === "true";
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/driver?error=assignment");
  const { error } = await supabase.rpc("driver_respond_to_assignment", {
    p_order_id: orderId, p_accept: accept,
  });
  if (error) redirect("/driver?error=assignment");
  revalidatePath("/driver");
}


export async function confirmRiderOnTheWay(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/driver?error=commitment");
  const { error } = await supabase.rpc("driver_confirm_on_the_way", { p_order_id: orderId });
  if (error) redirect("/driver?error=commitment");
  revalidatePath("/driver");
}

export async function releaseDriverClaim(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/driver?error=release");
  const { error } = await supabase.rpc("driver_release_order_claim", { p_order_id: orderId });
  if (error) redirect("/driver?error=release");
  revalidatePath("/driver");
}

export async function updateDriverOrderStatus(formData: FormData) {
  const { supabase, user } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "");
  const note = String(formData.get("driver_note") ?? "").trim().slice(0, 500);
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !["picked_up", "in_transit", "delivered"].includes(nextStatus)) {
    redirect("/driver?error=delivery");
  }

  let proofPath: string | null = null;
  if (nextStatus === "delivered") {
    const file = formData.get("delivery_proof");
    if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      redirect("/driver?error=proof");
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    proofPath = `${user.id}/${orderId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("delivery-proofs").upload(proofPath, file, {
      contentType: file.type, upsert: false,
    });
    if (uploadError) redirect("/driver?error=upload");
  }

  const { error } = await supabase.rpc("driver_update_order_status", {
    p_order_id: orderId, p_next_status: nextStatus,
    p_proof_path: proofPath, p_note: note || null,
  });
  if (error) {
    if (proofPath) await supabase.storage.from("delivery-proofs").remove([proofPath]);
    redirect("/driver?error=delivery");
  }
  if (nextStatus === "delivered") await dispatchCompletedOrderReceiptWorker();
  revalidatePath("/driver");
}


export async function requestDriverPayout(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const amount = Number(formData.get("amount"));
  const payoutMethod = String(formData.get("payout_method") ?? "").trim();
  const accountName = String(formData.get("account_name") ?? "").trim().slice(0,120);
  const accountNumber = String(formData.get("account_number") ?? "").trim().slice(0,80);
  const note = String(formData.get("driver_note") ?? "").trim().slice(0,300);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 ||
      !["gcash","bank_transfer"].includes(payoutMethod) || !accountName || !accountNumber) {
    redirect("/driver/earnings?error=details");
  }
  const { error } = await supabase.rpc("driver_request_payout", {
    p_amount: Math.round(amount * 100) / 100,
    p_payout_method: payoutMethod,
    p_account_snapshot: { account_name: accountName, account_number: accountNumber },
    p_driver_note: note || null,
  });
  if (error) redirect("/driver/earnings?error=balance");
  revalidatePath("/driver/earnings");
  redirect("/driver/earnings?requested=1");
}

export async function reportDriverEmergencyBeforePickup(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || reason.length < 3) redirect("/driver?error=emergency");
  const { error } = await supabase.rpc("driver_report_emergency_before_pickup", {
    p_order_id: orderId, p_reason: reason,
  });
  if (error) redirect("/driver?error=emergency");
  revalidatePath("/driver");
  redirect("/driver?updated=emergency");
}


export async function acceptServiceRequest(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const requestId = String(formData.get("request_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) redirect("/driver?error=service-request");
  const { error } = await supabase.rpc("driver_accept_service_request", { p_request_id: requestId });
  if (error) {
    console.error("[service-request] rider acceptance failed:", error.message);
    redirect("/driver?error=service-request");
  }
  revalidatePath("/driver");
}

export async function updateServiceRequest(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const requestId = String(formData.get("request_id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "");
  const amountRaw = String(formData.get("actual_purchase_amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const gcashReference = String(formData.get("gcash_reference") ?? "").trim().slice(0,120);
  if (!/^[0-9a-f-]{36}$/i.test(requestId) ||
      !["purchased","picked_up","in_transit","delivered"].includes(nextStatus) ||
      (amount !== null && (!Number.isFinite(amount) || amount < 0)) ||
      (nextStatus === "delivered" && !["cash","gcash"].includes(paymentMethod)) ||
      (nextStatus === "delivered" && paymentMethod === "gcash" && !gcashReference)) {
    redirect("/driver?error=service-request");
  }
  const { error } = await supabase.rpc("driver_update_service_request", {
    p_request_id: requestId,
    p_next_status: nextStatus,
    p_actual_purchase_amount: amount,
    p_payment_method: nextStatus === "delivered" ? paymentMethod : null,
    p_gcash_reference: nextStatus === "delivered" && paymentMethod === "gcash" ? gcashReference : null,
  });
  if (error) {
    console.error("[service-request] rider update failed:", error.message);
    redirect("/driver?error=service-request");
  }
  revalidatePath("/driver");
}


export async function cancelServiceRequest(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const requestId = String(formData.get("request_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || reason.length < 3) redirect("/driver?error=service-request");
  const { error } = await supabase.rpc("driver_cancel_service_request", { p_request_id: requestId, p_reason: reason });
  if (error) {
    console.error("[service-request] rider cancellation failed:", error.message);
    redirect("/driver?error=service-request");
  }
  revalidatePath("/driver");
  redirect("/driver?updated=service-cancelled");
}
