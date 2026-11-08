"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    redirect("/forgot-password?error=invalid");
  }

  const supabase = await createClient();
  // Keep recovery on the same deployment/environment where it was requested.
  // This prevents Preview reset emails from being redirected to Production.
  const siteOrigin =
    process.env.VERCEL_ENV === "production"
      ? (process.env.NEXT_PUBLIC_SITE_URL || "https://sugomate.com")
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://sugomate.com");
  const redirectTo = new URL("/auth/callback?next=%2Freset-password", siteOrigin).toString();

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Use the same confirmation message whether or not the account exists.
  // This avoids disclosing registered email addresses.
  if (error) redirect("/forgot-password?error=send");
  redirect("/forgot-password?success=requested");
}
