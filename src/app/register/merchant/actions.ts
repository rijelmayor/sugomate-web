"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAndSendPhoneOtp } from "@/lib/phone-verification";

export async function signUpMerchant(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const municipalityId = String(formData.get("municipality_id") ?? "");
  const requestedNext = String(formData.get("next") ?? "");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/merchant/apply";
  const nextQuery = `&next=${encodeURIComponent(next)}`;

  if (!displayName || !email || password.length < 8 || !phone || !/^[0-9a-f-]{36}$/i.test(municipalityId)) redirect(`/register/merchant?error=invalid&next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const { data: locality } = await supabase.from("municipalities").select("id").eq("id", municipalityId).eq("is_serviceable", true).maybeSingle();
  if (!locality) redirect(`/register/merchant?error=invalid&next=${encodeURIComponent(next)}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://sugomate.com"}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { display_name: displayName, phone, municipality_id: municipalityId, intended_role: "merchant" },
    },
  });
  if (error || !data.user) redirect(`/register/merchant?error=signup&next=${encodeURIComponent(next)}`);

  try { await createAndSendPhoneOtp(data.user.id, email, phone); }
  catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("valid Philippine")) redirect(`/register/merchant?error=invalid&next=${encodeURIComponent(next)}`);
    redirect(`/verify-phone?email=${encodeURIComponent(email)}${nextQuery}&error=sms`);
  }
  redirect(`/verify-phone?email=${encodeURIComponent(email)}${nextQuery}`);
}
