import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roleSet = new Set((roles ?? []).map(row => row.role));
  if (roleSet.has("admin")) redirect("/admin");
  if (roleSet.has("driver")) redirect("/driver");
  if (roleSet.has("merchant")) redirect("/merchant");
  if (roleSet.has("customer")) redirect("/customer");
  redirect("/account/setup");
}
