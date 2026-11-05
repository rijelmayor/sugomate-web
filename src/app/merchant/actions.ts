"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateMerchantOrderStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orderId = String(formData.get("order_id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (!/^[0-9a-f-]{36}$/i.test(orderId) ||
      !["accepted", "rejected", "preparing", "ready_for_pickup", "cancelled"].includes(nextStatus)) {
    redirect("/merchant?error=invalid");
  }

  const { error } = await supabase.rpc("merchant_update_order_status", {
    p_order_id: orderId,
    p_next_status: nextStatus,
    p_note: note || null,
  });
  if (error) throw new Error("Could not update this order. Please try again.");
  revalidatePath("/merchant");
}
