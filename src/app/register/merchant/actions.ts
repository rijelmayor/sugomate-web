"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAndSendPhoneOtp } from "@/lib/phone-verification";

export async function signUpMerchant(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = String(formData.get("next") ?? "");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/merchant/apply";
  const nextQuery = `&next=${encodeURIComponent(next)}`;

  if (!displayName || !email || password.length < 8 || !phone) redirect(`/register/merchant?error=invalid&next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://sugomate.com"}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { display_name: displayName, phone, intended_role: "merchant" },
    },
  });
  if (error || !data.user) redirect(`/register/merchant?error=signup&next=${encodeURIComponent(next)}`);

  try { await createAndSendPhoneOtp(data.user.id, email, phone); }
  catch { redirect(`/verify-phone?email=${encodeURIComponent(email)}${nextQuery}&error=sms`); }
  redirect(`/verify-phone?email=${encodeURIComponent(email)}${nextQuery}`);
}
