"use server";

import { randomUUID } from "crypto";
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
  const address = String(formData.get("business_address") ?? "").trim().slice(0, 500);
  const contactPhone = String(formData.get("business_phone") ?? "").trim().slice(0, 20);
  const description = String(formData.get("business_description") ?? "").trim().slice(0, 1000);
  if (!name || slug.length < 3) redirect("/merchant/apply?error=details");

  const { data: merchant, error } = await supabase.from("merchants")
    .insert({ owner_id: user.id, name, slug, status: "pending", address: address || null, contact_phone: contactPhone || null, description: description || null })
    .select("id").single();
  if (error || !merchant) redirect("/merchant/apply?error=application");

  const { error: memberError } = await supabase.from("merchant_members")
    .insert({ merchant_id: merchant.id, user_id: user.id, member_role: "owner" });
  if (memberError) redirect("/merchant/apply?error=membership");
  redirect("/merchant/apply?success=submitted");
}

const DOC_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VEHICLES = ["Motorcycle", "Bicycle", "Car", "Other"];

// Validates and uploads the applicant's documents to the private driver-documents bucket.
async function uploadDriverDocuments(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, formData: FormData, vehicleType: string, errorPath: string) {
  // Documents are optional. Upload any that are provided.
  const spec = [
    { field: "id_document", key: "id", required: false },
    { field: "selfie_document", key: "selfie", required: false },
    { field: "profile_photo", key: "profile_photo", required: false },
    { field: "license_document", key: "license", required: false },
  ] as const;
  const files: Record<string, File> = {};
  for (const item of spec) {
    const value = formData.get(item.field);
    const present = value instanceof File && value.size > 0;
    if (!present) { if (item.required) redirect(`${errorPath}?error=docs`); continue; }
    const typeOk = DOC_TYPES.includes(value.type) || /\.jpe?g$/i.test(value.name) || value.type === "";
    if (value.size > 5 * 1024 * 1024 || !typeOk) redirect(`${errorPath}?error=docs`);
    files[item.key] = value;
  }
  const uploaded: string[] = [];
  const paths: Record<string, string | null> = { id: null, selfie: null, license: null, profile_photo: null };
  for (const [key, file] of Object.entries(files)) {
    // Prefer JPEG after client compression; fall back to detected type
    const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
    const extension = isJpeg ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const contentType = isJpeg ? "image/jpeg" : file.type || "image/jpeg";
    const path = `${userId}/${key}-${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("driver-documents").upload(path, file, { contentType, upsert: false });
    if (error) {
      console.error("[driver-docs] upload failed", { path, contentType, size: file.size, message: error.message });
      if (uploaded.length) await supabase.storage.from("driver-documents").remove(uploaded);
      redirect(`${errorPath}?error=upload`);
    }
    uploaded.push(path);
    paths[key] = path;
  }
  return { paths, uploaded };
}

export async function applyAsDriver(formData: FormData) {
  const { supabase, user } = await requireUser();
  const vehicleType = String(formData.get("vehicle_type") ?? "").trim();
  const vehiclePlate = String(formData.get("vehicle_plate") ?? "").trim().slice(0, 20);
  const ageRaw = String(formData.get("age") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim().slice(0, 500);
  const age = ageRaw ? Number(ageRaw) : null;
  if (!VEHICLES.includes(vehicleType)) redirect("/driver/apply?error=details");
  if (age !== null && (Number.isNaN(age) || age < 18 || age > 80)) redirect("/driver/apply?error=details");

  const { paths, uploaded } = await uploadDriverDocuments(supabase, user.id, formData, vehicleType, "/driver/apply");
  const { error } = await supabase.from("driver_profiles").insert({
    user_id: user.id, vehicle_type: vehicleType, vehicle_plate: vehiclePlate || null, status: "pending",
    age, address: address || null,
    id_storage_path: paths.id, selfie_storage_path: paths.selfie, license_storage_path: paths.license, profile_photo_path: paths.profile_photo,
  });
  if (error) {
    await supabase.storage.from("driver-documents").remove(uploaded);
    redirect("/driver/apply?error=application");
  }
  redirect("/driver/apply?success=submitted");
}

// For applicants who applied before IDs were required: attach documents to the pending application.
export async function submitDriverDocuments(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { data: driver } = await supabase.from("driver_profiles").select("status,vehicle_type,profile_photo_path").eq("user_id", user.id).maybeSingle();
  if (!driver || driver.status !== "pending") redirect("/driver/apply");
  const { paths, uploaded } = await uploadDriverDocuments(supabase, user.id, formData, String(driver.vehicle_type ?? ""), "/driver/apply");
  const { error } = await supabase.from("driver_profiles")
    .update({ id_storage_path: paths.id, selfie_storage_path: paths.selfie, license_storage_path: paths.license, profile_photo_path: paths.profile_photo ?? driver.profile_photo_path })
    .eq("user_id", user.id);
  if (error) {
    await supabase.storage.from("driver-documents").remove(uploaded);
    redirect("/driver/apply?error=application");
  }
  redirect("/driver/apply?success=documents");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}
