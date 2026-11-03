"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function merchantContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await supabase.from("merchant_members")
    .select("merchant_id,merchants(id,name,status)")
    .eq("user_id", user.id);
  const stores = (memberships ?? []).map((row) => ({
    id: row.merchant_id,
    merchant: row.merchants as unknown as { id: string; name: string; status: string } | null,
  })).filter((row) => row.merchant?.status === "approved");
  if (!stores.length) redirect("/merchant?error=no-approved-store");
  return { supabase, stores };
}

export async function createMerchantBranch(formData: FormData) {
  const { supabase, stores } = await merchantContext();
  const merchantId = String(formData.get("merchant_id") ?? "");
  const store = stores.find((item) => item.id === merchantId);
  const municipalityId = String(formData.get("municipality_id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const address = String(formData.get("address_line") ?? "").trim().slice(0, 250);
  const phone = String(formData.get("contact_phone") ?? "").trim().slice(0, 30);
  if (!store || !/^[0-9a-f-]{36}$/i.test(municipalityId) || name.length < 2 || address.length < 5) redirect("/merchant/products?error=branch");
  const { error } = await supabase.from("merchant_branches").insert({
    merchant_id: merchantId, municipality_id: municipalityId, name,
    address_line: address, contact_phone: phone || null, is_active: true,
  });
  if (error) redirect("/merchant/products?error=branch");
  redirect("/merchant/products?created=branch");
}

export async function saveMerchantProduct(formData: FormData) {
  const { supabase, stores } = await merchantContext();
  const id = String(formData.get("product_id") ?? "");
  const merchantId = String(formData.get("merchant_id") ?? "");
  const branchId = String(formData.get("branch_id") ?? "");
  const store = stores.find((item) => item.id === merchantId);
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const description = String(formData.get("description") ?? "").trim().slice(0, 1000);
  const price = Number(formData.get("price"));
  const stockRaw = String(formData.get("stock_quantity") ?? "").trim();
  const stock = stockRaw === "" ? null : Number(stockRaw);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  const available = formData.get("is_available") === "on";
  if (!store || !/^[0-9a-f-]{36}$/i.test(branchId) || name.length < 2 || !Number.isFinite(price) || price < 0 ||
      (stock !== null && (!Number.isInteger(stock) || stock < 0)) ||
      (imageUrl && !/^https:\/\//i.test(imageUrl)) ||
      (id && !/^[0-9a-f-]{36}$/i.test(id))) redirect("/merchant/products?error=product");
  const payload = {
    merchant_id: merchantId, branch_id: branchId, category_id: categoryId,
    name, description: description || null, price, stock_quantity: stock,
    image_url: imageUrl || null, is_available: available, updated_at: new Date().toISOString(),
  };
  const result = id
    ? await supabase.from("products").update(payload).eq("id", id).eq("merchant_id", merchantId)
    : await supabase.from("products").insert(payload);
  if (result.error) redirect("/merchant/products?error=product");
  redirect("/merchant/products?saved=1");
}

export async function deleteMerchantProduct(formData: FormData) {
  const { supabase, stores } = await merchantContext();
  const id = String(formData.get("product_id") ?? "");
  const merchantId = String(formData.get("merchant_id") ?? "");
  if (!stores.some((item) => item.id === merchantId) || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/merchant/products?error=product");
  const { error } = await supabase.from("products").delete().eq("id", id).eq("merchant_id", merchantId);
  if (error) redirect("/merchant/products?error=product");
  redirect("/merchant/products?deleted=1");
}
