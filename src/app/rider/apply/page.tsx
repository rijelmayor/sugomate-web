import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RiderApplyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/register");
  redirect("/dashboard?partner=driver#rider-application");
}
