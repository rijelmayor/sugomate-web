"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) redirect("/dashboard?error=admin-access");
  return supabase;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export async function saveMerchantCategory(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("category_id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const icon = String(formData.get("icon") ?? "🏪").trim().slice(0, 12) || "🏪";
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const isActive = formData.get("is_active") === "on";
  const slug = slugify(name);
  if (name.length < 2 || !slug || !Number.isInteger(sortOrder) || sortOrder < 0 ||
      (id && !/^[0-9a-f-]{36}$/i.test(id))) redirect("/admin/store-categories?error=invalid");
  // Photo: keep the current one unless a new WebP is uploaded or removal is ticked. No photo = gradient default.
  const existing = String(formData.get("image_url") ?? "").trim().slice(0, 500);
  let imageUrl: string | null = /^(\/|https:\/\/)/.test(existing) ? existing : null;
  const file = formData.get("category_image");
  let uploadedPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const tag = (from: number) => String.fromCharCode(...head.slice(from, from + 4));
    if (file.type !== "image/webp" || file.size > 2 * 1024 * 1024 || tag(0) !== "RIFF" || tag(8) !== "WEBP") redirect("/admin/store-categories?error=image");
    uploadedPath = `${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from("category-images").upload(uploadedPath, file, { contentType: "image/webp", cacheControl: "3600", upsert: false });
    if (uploadError) redirect("/admin/store-categories?error=image");
    imageUrl = supabase.storage.from("category-images").getPublicUrl(uploadedPath).data.publicUrl;
  } else if (formData.get("remove_image") === "on") {
    imageUrl = null;
  }
  const payload = { name, slug, icon, image_url: imageUrl, sort_order: sortOrder, is_active: isActive };
  const result = id
    ? await supabase.from("merchant_categories").update(payload).eq("id", id)
    : await supabase.from("merchant_categories").insert(payload);
  if (result.error) {
    if (uploadedPath) await supabase.storage.from("category-images").remove([uploadedPath]);
    redirect("/admin/store-categories?error=save");
  }
  // Tidy up the replaced or removed photo (best effort).
  const marker = "/category-images/";
  if (imageUrl !== (existing || null) && existing.includes(marker)) await supabase.storage.from("category-images").remove([existing.split(marker)[1]]);
  redirect("/admin/store-categories?saved=1");
}

export async function assignMerchantCategory(formData: FormData) {
  const supabase = await requireAdmin();
  const merchantId = String(formData.get("merchant_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  if (!/^[0-9a-f-]{36}$/i.test(merchantId) ||
      (categoryId && !/^[0-9a-f-]{36}$/i.test(categoryId))) {
    redirect("/admin/store-categories?error=invalid");
  }
  const { error } = await supabase.from("merchants")
    .update({ category_id: categoryId }).eq("id", merchantId);
  if (error) redirect("/admin/store-categories?error=assign");
  redirect("/admin/store-categories?assigned=1");
}
