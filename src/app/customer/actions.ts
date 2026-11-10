"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireCustomer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function saveCustomerAddress(formData: FormData) {
  const { supabase, user } = await requireCustomer();
  const label = String(formData.get("label") ?? "Home").trim().slice(0,40) || "Home";
  const recipientName = String(formData.get("recipient_name") ?? "").trim().slice(0,120);
  const recipientPhone = String(formData.get("recipient_phone") ?? "").trim().slice(0,40);
  const municipalityId = String(formData.get("municipality_id") ?? "");
    const serviceZoneId = String(formData.get("service_zone_id") ?? "");
  const addressLine = String(formData.get("address_line") ?? "").trim().slice(0,300);
  const landmark = String(formData.get("landmark") ?? "").trim().slice(0,200);
  if (!recipientName || !recipientPhone || !municipalityId || !/^[0-9a-f-]{36}$/i.test(serviceZoneId) || !addressLine) redirect("/customer/addresses?error=required");
  const { error } = await supabase.from("customer_addresses").insert({
    customer_id:user.id,label,recipient_name:recipientName,recipient_phone:recipientPhone,
    municipality_id:municipalityId,service_zone_id:serviceZoneId,address_line:addressLine,landmark:landmark || null
  });
  if (error) redirect("/customer/addresses?error=save");
  redirect("/customer/addresses?saved=1");
}

export async function placeOrder(formData: FormData) {
  const { supabase, user } = await requireCustomer();
  let addressId = String(formData.get("address_id") ?? "");
  const note = String(formData.get("customer_note") ?? "").trim().slice(0,500);
  const paymentMethod = String(formData.get("payment_method") ?? "cod");
  if (!["cod","gcash","wallet"].includes(paymentMethod)) redirect("/customer?error=checkout");
  if (addressId === "__new__" || !addressId) {
    const label = String(formData.get("new_label") ?? "Home").trim().slice(0,40) || "Home";
    const recipientName = String(formData.get("recipient_name") ?? "").trim().slice(0,120);
    const recipientPhone = String(formData.get("recipient_phone") ?? "").trim().slice(0,40);
    const municipalityId = String(formData.get("municipality_id") ?? "");
    const serviceZoneId = String(formData.get("service_zone_id") ?? "");
    const addressLine = String(formData.get("address_line") ?? "").trim().slice(0,300);
    const landmark = String(formData.get("landmark") ?? "").trim().slice(0,200);
    if (!recipientName || !recipientPhone || !/^[0-9a-f-]{36}$/i.test(municipalityId) || !/^[0-9a-f-]{36}$/i.test(serviceZoneId) || addressLine.length < 5) redirect("/customer?error=address");
    const { data: address, error: addressError } = await supabase.from("customer_addresses").insert({
      customer_id: user.id, label, recipient_name: recipientName,
      recipient_phone: recipientPhone, municipality_id: municipalityId, service_zone_id: serviceZoneId, address_line: addressLine, landmark: landmark || null
    }).select("id").single();
    if (addressError || !address) redirect("/customer?error=address");
    addressId = address.id;
  }
  let items: unknown;
  try { items = JSON.parse(String(formData.get("items") ?? "[]")); } catch { redirect("/customer?error=basket"); }
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) redirect("/customer?error=basket");
  const safeItems = items.map((item: unknown) => {
    const row = item as { product_id?: unknown; quantity?: unknown };
    return { product_id:String(row.product_id ?? ""), quantity:Number(row.quantity) };
  });
  if (safeItems.some(item => !/^[0-9a-f-]{36}$/i.test(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) redirect("/customer?error=basket");
  const { data, error } = paymentMethod === "wallet"
    ? await supabase.rpc("place_customer_order_with_wallet", {
        p_address_id:addressId,p_items:safeItems,p_customer_note:note || null
      })
    : await supabase.rpc("place_customer_order", {
        p_address_id:addressId,p_items:safeItems,p_payment_method:paymentMethod,p_customer_note:note || null
      });
  if (error || !data) {
    console.error("[customer] place_customer_order failed:", error ? { code: error.code, message: error.message, details: error.details, hint: error.hint } : "RPC returned no order ID");
    redirect("/customer?error=checkout");
  }
  redirect("/customer/orders?placed=1");
}
