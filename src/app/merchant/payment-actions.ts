"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmGcashPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/merchant?error=payment");
  const { error } = await supabase.rpc("merchant_confirm_gcash_payment", { p_order_id: orderId });
  if (error) redirect("/merchant?tab=active&error=payment");
  revalidatePath("/merchant");
  revalidatePath("/customer/orders");
  redirect("/merchant?tab=active&paymentConfirmed=1");
}
