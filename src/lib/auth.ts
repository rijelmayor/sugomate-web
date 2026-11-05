import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// React cache() dedupes these within one server render, so the layout and the
// page share a single auth + roles lookup instead of repeating it.
export const getSupabase = cache(async () => createClient());

export const getUser = cache(async () => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getRoleSet = cache(async () => {
  const user = await getUser();
  if (!user) return new Set<string>();
  const supabase = await getSupabase();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return new Set((data ?? []).map(row => String(row.role)));
});

export const requireCustomer = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  const roles = await getRoleSet();
  if (roles.has("admin")) redirect("/admin");
  if (roles.has("driver")) redirect("/driver");
  if (roles.has("merchant")) redirect("/merchant");
  if (!roles.has("customer")) redirect("/login?error=role");
  return { user, supabase: await getSupabase() };
});
