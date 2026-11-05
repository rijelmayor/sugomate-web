"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitGcashPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orderId = String(formData.get("order_id") ?? "");
  const reference = String(formData.get("transaction_reference") ?? "").trim();
  const file = formData.get("payment_proof");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) redirect("/customer/orders?paymentError=order");
  if (!/^[A-Za-z0-9-]{6,40}$/.test(reference)) redirect("/customer/orders?paymentError=reference");
  if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024 ||
      !["image/jpeg","image/png","image/webp"].includes(file.type)) {
    redirect("/customer/orders?paymentError=file");
  }

  const { data: order } = await supabase.from("orders")
    .select("id,payment_method,payment_status,status")
    .eq("id", orderId).eq("customer_id", user.id).maybeSingle();
  if (!order || order.payment_method !== "gcash" || order.payment_status === "paid" ||
      ["cancelled","rejected","delivered"].includes(order.status)) {
    redirect("/customer/orders?paymentError=order");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${orderId}/${user.id}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("gcash-payment-proofs")
    .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) redirect("/customer/orders?paymentError=upload");

  const { error } = await supabase.rpc("customer_submit_gcash_payment", {
    p_order_id: orderId,
    p_transaction_reference: reference,
    p_proof_path: path,
  });
  if (error) {
    await supabase.storage.from("gcash-payment-proofs").remove([path]);
    redirect("/customer/orders?paymentError=submit");
  }

  revalidatePath("/customer/orders");
  revalidatePath("/merchant");
  redirect("/customer/orders?paymentSubmitted=1");
}
