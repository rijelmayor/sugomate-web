"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ServiceType = "papalit" | "pasugo";

export async function createServiceRequest(formData: FormData) {
  const serviceType = String(formData.get("service_type") ?? "") as ServiceType;
  if (serviceType !== "papalit" && serviceType !== "pasugo") redirect("/customer");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("request_title") ?? "").trim().slice(0, 140);
  const instructions = String(formData.get("instructions") ?? "").trim().slice(0, 1000);
  const rawItems = String(formData.get("items") ?? "").trim();
  const addressId = String(formData.get("address_id") ?? "");
  const budgetValue = String(formData.get("customer_budget") ?? "").trim();
  const budget = budgetValue ? Number(budgetValue) : null;
  const pickupLocation = String(formData.get("pickup_location") ?? "").trim().slice(0, 300);
  const pickupContactName = String(formData.get("pickup_contact_name") ?? "").trim().slice(0, 120);
  const pickupContactPhone = String(formData.get("pickup_contact_phone") ?? "").trim().slice(0, 40);
  const purchaseRequired = serviceType === "papalit" || String(formData.get("purchase_required")) === "true";

  if (title.length < 2 || !rawItems || !addressId || (budget !== null && (!Number.isFinite(budget) || budget < 1 || budget > 50000))) {
    redirect(serviceType === "papalit" ? "/papalit?error=details" : "/pasugo?error=details");
  }
  if (serviceType === "pasugo" && pickupLocation.length < 3) redirect("/pasugo?error=pickup");
  if (serviceType === "pasugo" && purchaseRequired && budget === null) redirect("/pasugo?error=details");

  const { data: address } = await supabase.from("customer_addresses")
    .select("id,label,recipient_name,recipient_phone,address_line,landmark,municipality_id,municipalities(name)")
    .eq("id", addressId).eq("customer_id", user.id).maybeSingle();
  if (!address) redirect(serviceType === "papalit" ? "/papalit?error=address" : "/pasugo?error=address");

  const items = rawItems.split(/\\r?\\n/).map(line => line.trim()).filter(Boolean).slice(0, 30).map(line => {
    const match = line.match(/^(\\d+)\\s*[x×]\\s*(.+)$/i);
    return { quantity: match ? Math.min(99, Number(match[1])) : 1, name: (match ? match[2] : line).slice(0, 140) };
  });
  if (!items.length || items.some(item => !item.name || item.quantity < 1)) redirect(serviceType === "papalit" ? "/papalit?error=items" : "/pasugo?error=items");

  const requestId = randomUUID();
  const municipality = Array.isArray(address.municipalities) ? address.municipalities[0] : address.municipalities;
  const addressSnapshot = {
    label: address.label,
    recipient_name: address.recipient_name,
    recipient_phone: address.recipient_phone,
    address_line: address.address_line,
    landmark: address.landmark,
    municipality: municipality?.name ?? null,
  };

  const { error } = await supabase.from("service_requests").insert({
    id: requestId,
    service_type: serviceType,
    customer_id: user.id,
    status: "pending_review",
    request_title: title,
    instructions,
    items,
    purchase_required: purchaseRequired,
    pickup_location: serviceType === "pasugo" ? pickupLocation : null,
    pickup_contact_name: serviceType === "pasugo" ? pickupContactName || null : null,
    pickup_contact_phone: serviceType === "pasugo" ? pickupContactPhone || null : null,
    delivery_address_snapshot: addressSnapshot,
    municipality_id: address.municipality_id,
    customer_budget: budget,
  });
  if (error) {
    console.error("[service-request] create failed:", error.message);
    redirect(serviceType === "papalit" ? "/papalit?error=save" : "/pasugo?error=save");
  }

  await supabase.from("service_request_events").insert({
    service_request_id: requestId,
    actor_user_id: user.id,
    actor_role: "customer",
    event_type: "request_submitted",
    note: serviceType === "papalit" ? "Papalit request submitted." : "Pasugo request submitted.",
  });

  const file = formData.get("reference_image");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      redirect(serviceType === "papalit" ? "/papalit?error=image" : "/pasugo?error=image");
    }
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${requestId}/reference.${ext}`;
    const { error: uploadError } = await supabase.storage.from("service-request-evidence").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error("[service-request] reference upload failed:", uploadError.message);
      redirect(serviceType === "papalit" ? "/papalit?error=image" : "/pasugo?error=image");
    }
    const { error: attachError } = await supabase.rpc("customer_attach_service_request_reference", { p_request_id: requestId, p_path: path });
    if (attachError) {
      console.error("[service-request] reference attach failed:", attachError.message);
      redirect(serviceType === "papalit" ? "/papalit?error=image" : "/pasugo?error=image");
    }
  }

  revalidatePath("/papalit");
  revalidatePath("/pasugo");
  revalidatePath("/customer/service-requests");
  redirect("/customer/service-requests?submitted=1");
}
