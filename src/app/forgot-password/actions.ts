"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    redirect("/forgot-password?error=invalid");
  }

  const supabase = await createClient();

  // Use the stable Vercel branch alias for preview recovery so it can be
  // explicitly allowlisted in Supabase Auth (deployment-specific URLs change).
  const siteOrigin =
    process.env.VERCEL_ENV === "production"
      ? (process.env.NEXT_PUBLIC_SITE_URL || "https://sugomate.com")
      : "https://sugomate-web-git-feat-web-password-159a5c-rijelmayors-projects.vercel.app";

  const redirectTo = new URL(
    "/auth/callback?next=%2Freset-password",
    siteOrigin,
  ).toString();

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    console.error("[password-reset] Supabase request failed:", error.message);
    redirect("/forgot-password?error=send");
  }

  redirect("/forgot-password?success=requested");
}
