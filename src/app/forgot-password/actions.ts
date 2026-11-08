"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Standard email shape check; the previous pattern was over-escaped
  // and incorrectly rejected valid addresses containing normal characters.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/forgot-password?error=invalid");
  }

  const supabase = await createClient();
  const siteOrigin =
    process.env.VERCEL_ENV === "production"
      ? (process.env.NEXT_PUBLIC_SITE_URL || "https://sugomate.com")
      : (process.env.VERCEL_URL ? \`https://\${process.env.VERCEL_URL}\` : "https://sugomate.com");
  const redirectTo = new URL("/auth/callback?next=%2Freset-password", siteOrigin).toString();

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) redirect("/forgot-password?error=send");
  redirect("/forgot-password?success=requested");
}
