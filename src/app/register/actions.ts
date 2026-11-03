"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!displayName || !email || password.length < 8) redirect("/register?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://sugomate.com"}/auth/callback`,
      data: { display_name: displayName, phone },
    },
  });
  if (error) redirect("/register?error=signup");
  if (data.session) redirect("/dashboard");
  redirect("/register?success=check-email");
}
