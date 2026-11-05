"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const days = ["mon","tue","wed","thu","fri","sat","sun"] as const;

export async function saveMerchantStorefront(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const merchantId = String(formData.get("merchant_id") ?? "");
  const branchId = String(formData.get("branch_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(merchantId) || !/^[0-9a-f-]{36}$/i.test(branchId)) redirect("/merchant/storefront?error=branch");

  const { data: membership } = await supabase.from("merchant_members")
    .select("merchant_id,merchants(status)").eq("user_id", user.id).eq("merchant_id", merchantId).maybeSingle();
  const merchant = membership?.merchants as unknown as { status: string } | null;
  if (!membership || merchant?.status !== "approved") redirect("/merchant/storefront?error=permission");

  const hours: Record<string, {open:string;close:string;closed:boolean}> = {};
  for (const day of days) {
    const open = String(formData.get(day + "_open") ?? "08:00");
    const close = String(formData.get(day + "_close") ?? "20:00");
    const closed = formData.get(day + "_closed") === "on";
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(open) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(close) || close <= open) redirect("/merchant/storefront?error=hours");
    hours[day] = { open, close, closed };
  }

  const methods = formData.getAll("payment_method").map(String).filter(v => v === "cod" || v === "gcash");
  if (!methods.length) redirect("/merchant/storefront?error=payment");

  let qrUrl = String(formData.get("existing_gcash_qr_url") ?? "").trim();
  const qrFile = formData.get("gcash_qr") as File | null;
  if (qrFile && qrFile.size > 0) {
    if (!["image/png","image/jpeg","image/webp"].includes(qrFile.type) || qrFile.size > 5 * 1024 * 1024) redirect("/merchant/storefront?error=qr");
    const ext = qrFile.type === "image/png" ? "png" : qrFile.type === "image/webp" ? "webp" : "jpg";
    const path = `${merchantId}/${user.id}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("merchant-payment-qr").upload(path, qrFile, { contentType: qrFile.type, cacheControl: "3600", upsert: false });
    if (uploadError) redirect("/merchant/storefront?error=qr");
    qrUrl = supabase.storage.from("merchant-payment-qr").getPublicUrl(path).data.publicUrl;
  }
  if (methods.includes("gcash") && !/^https:\/\//i.test(qrUrl)) redirect("/merchant/storefront?error=qr-required");

  const { error } = await supabase.rpc("merchant_save_storefront_settings", {
    p_merchant_id: merchantId,
    p_branch_id: branchId,
    p_store_hours: hours,
    p_temporarily_closed: formData.get("temporarily_closed") === "on",
    p_payment_methods: methods,
    p_gcash_qr_url: qrUrl || null,
  });
  if (error) redirect("/merchant/storefront?error=save");
  redirect("/merchant/storefront?saved=1");
}
