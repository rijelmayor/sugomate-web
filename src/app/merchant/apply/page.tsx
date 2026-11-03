import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MerchantApplyRedirect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/register");
  redirect("/dashboard?partner=merchant#merchant-application");
}
