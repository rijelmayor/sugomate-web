"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function applyAsMerchant(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("business_name") ?? "").trim();
  const slug = String(formData.get("business_slug") ?? "").trim().toLowerCase()
    .normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!name || slug.length < 3) redirect("/merchant/apply?error=details");

  const { data: merchant, error } = await supabase.from("merchants")
    .insert({ owner_id: user.id, name, slug, status: "pending" })
    .select("id").single();
  if (error || !merchant) redirect("/merchant/apply?error=application");

  const { error: memberError } = await supabase.from("merchant_members")
    .insert({ merchant_id: merchant.id, user_id: user.id, member_role: "owner" });
  if (memberError) redirect("/merchant/apply?error=membership");
  redirect("/merchant/apply?success=submitted");
}

export async function applyAsDriver(formData: FormData) {
  const { supabase, user } = await requireUser();
  const vehicleType = String(formData.get("vehicle_type") ?? "").trim();
  const vehiclePlate = String(formData.get("vehicle_plate") ?? "").trim();
  if (!vehicleType) redirect("/driver/apply?error=details");

  const { error } = await supabase.from("driver_profiles").insert({
    user_id: user.id, vehicle_type: vehicleType, vehicle_plate: vehiclePlate || null, status: "pending",
  });
  if (error) redirect("/driver/apply?error=application");
  redirect("/driver/apply?success=submitted");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}
