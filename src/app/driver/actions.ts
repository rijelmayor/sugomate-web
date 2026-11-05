"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireActiveDriver() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/driver");
  const { data: profile } = await supabase.from("driver_profiles")
    .select("status").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.status !== "active") redirect("/driver/apply");
  return { supabase, user };
}

export async function setDriverAvailability(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const available = String(formData.get("is_available")) === "true";
  const { error } = await supabase.rpc("driver_set_availability", { p_is_available: available });
  if (error) throw new Error("Could not update availability. Please try again.");
  revalidatePath("/driver");
}

export async function claimReadyOrder(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/driver?error=claim");
  const { error } = await supabase.rpc("driver_claim_order", { p_order_id: orderId });
  if (error) throw new Error("Could not claim this order. Please try again.");
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
  if (error) throw new Error("Could not respond to this dispatch offer. Please try again.");
  revalidatePath("/driver");
}


export async function confirmRiderOnTheWay(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/driver?error=commitment");
  const { error } = await supabase.rpc("driver_confirm_on_the_way", { p_order_id: orderId });
  if (error) throw new Error("Could not confirm departure. Please try again.");
  revalidatePath("/driver");
}

export async function releaseDriverClaim(formData: FormData) {
  const { supabase } = await requireActiveDriver();
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/driver?error=release");
  const { error } = await supabase.rpc("driver_release_order_claim", { p_order_id: orderId });
  if (error) throw new Error("Could not release this order. Please try again.");
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
    throw new Error("Could not update this delivery. Please try again.");
  }
  revalidatePath("/driver");
}
