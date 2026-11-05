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
  if (!/^[0-9a-f-]{36}$/i.test(merchantId) || !/^[0-9a-f-]{36}$/i.test(branchId)) redirect(`/merchant/storefront?branch=${branchId}&error=branch`);

  const { data: membership } = await supabase.from("merchant_members")
    .select("merchant_id,merchants(status)").eq("user_id", user.id).eq("merchant_id", merchantId).maybeSingle();
  const merchant = membership?.merchants as unknown as { status: string } | null;
  if (!membership || merchant?.status !== "approved") redirect(`/merchant/storefront?branch=${branchId}&error=permission`);

  const hours: Record<string, {open:string;close:string;closed:boolean}> = {};
  for (const day of days) {
    const open = String(formData.get(day + "_open") ?? "08:00");
    const close = String(formData.get(day + "_close") ?? "20:00");
    const closed = formData.get(day + "_closed") === "on";
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(open) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(close) || close <= open) redirect(`/merchant/storefront?branch=${branchId}&error=hours`);
    hours[day] = { open, close, closed };
  }

  const methods = formData.getAll("payment_method").map(String).filter(v => v === "cod" || v === "gcash");
  if (!methods.length) redirect(`/merchant/storefront?branch=${branchId}&error=payment`);

  let qrUrl = String(formData.get("existing_gcash_qr_url") ?? "").trim();
  const qrFile = formData.get("gcash_qr") as File | null;
  if (qrFile && qrFile.size > 0) {
    if (!["image/png","image/jpeg","image/webp"].includes(qrFile.type) || qrFile.size > 5 * 1024 * 1024) redirect(`/merchant/storefront?branch=${branchId}&error=qr`);
    const ext = qrFile.type === "image/png" ? "png" : qrFile.type === "image/webp" ? "webp" : "jpg";
    const path = `${merchantId}/${user.id}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("merchant-payment-qr").upload(path, qrFile, { contentType: qrFile.type, cacheControl: "3600", upsert: false });
    if (uploadError) redirect(`/merchant/storefront?branch=${branchId}&error=qr`);
    qrUrl = supabase.storage.from("merchant-payment-qr").getPublicUrl(path).data.publicUrl;
  }
  if (methods.includes("gcash") && !/^https:\/\//i.test(qrUrl)) redirect(`/merchant/storefront?branch=${branchId}&error=qr-required`);

  // Store logo (optional): keep the current one unless a new WebP is uploaded or removal is ticked.
  const existingLogo = String(formData.get("existing_logo_url") ?? "").trim();
  let logoUrl: string | null = /^https:\/\//i.test(existingLogo) ? existingLogo : null;
  let logoChanged = false;
  const logoFile = formData.get("store_logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const head = new Uint8Array(await logoFile.slice(0, 12).arrayBuffer());
    const tag = (from: number) => String.fromCharCode(...head.slice(from, from + 4));
    if (logoFile.type !== "image/webp" || logoFile.size > 1024 * 1024 || tag(0) !== "RIFF" || tag(8) !== "WEBP") redirect(`/merchant/storefront?branch=${branchId}&error=logo`);
    const logoPath = `${merchantId}/${randomUUID()}.webp`;
    const { error: logoUploadError } = await supabase.storage.from("merchant-logos").upload(logoPath, logoFile, { contentType: "image/webp", cacheControl: "3600", upsert: false });
    if (logoUploadError) redirect(`/merchant/storefront?branch=${branchId}&error=logo`);
    logoUrl = supabase.storage.from("merchant-logos").getPublicUrl(logoPath).data.publicUrl;
    logoChanged = true;
  } else if (formData.get("remove_logo") === "on" && logoUrl) {
    logoUrl = null; logoChanged = true;
  }

  const { error } = await supabase.rpc("merchant_save_storefront_settings", {
    p_merchant_id: merchantId,
    p_branch_id: branchId,
    p_store_hours: hours,
    p_temporarily_closed: formData.get("temporarily_closed") === "on",
    p_payment_methods: methods,
    p_gcash_qr_url: qrUrl || null,
  });
  if (error) redirect(`/merchant/storefront?branch=${branchId}&error=save`);
  if (logoChanged) {
    const { error: logoError } = await supabase.rpc("merchant_set_logo", { p_merchant_id: merchantId, p_logo_url: logoUrl });
    if (logoError) redirect(`/merchant/storefront?branch=${branchId}&error=logo`);
    const marker = "/merchant-logos/";
    if (existingLogo.includes(marker)) await supabase.storage.from("merchant-logos").remove([existingLogo.split(marker)[1]]);
  }
  redirect(`/merchant/storefront?branch=${branchId}&saved=1`);
}
