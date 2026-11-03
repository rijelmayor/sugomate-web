"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAndSendPhoneOtp, verifyPhoneOtp } from "@/lib/phone-verification";
export async function signUp(formData: FormData) {
  const displayName=String(formData.get("display_name")??"").trim(), phone=String(formData.get("phone")??"").trim(), email=String(formData.get("email")??"").trim().toLowerCase(), password=String(formData.get("password")??"");
  if(!displayName||!email||password.length<8||!phone) redirect("/register?error=invalid");
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${process.env.NEXT_PUBLIC_SITE_URL??"https://sugomate.com"}/auth/callback`,data:{display_name:displayName,phone}}});
  if(error||!data.user) redirect("/register?error=signup");
  try { await createAndSendPhoneOtp(data.user.id,email,phone); }
  catch { redirect(`/verify-phone?email=${encodeURIComponent(email)}&error=sms`); }
  redirect(`/verify-phone?email=${encodeURIComponent(email)}`);
}
export async function verifyRegistrationPhone(formData:FormData){
  const email=String(formData.get("email")??"").trim().toLowerCase(), code=String(formData.get("code")??"").trim();
  if(!email) redirect("/register?error=invalid");
  const result=await verifyPhoneOtp(email,code);
  if(!result.ok) redirect(`/verify-phone?email=${encodeURIComponent(email)}&error=${result.reason}`);
  redirect("/login?success=phone-verified");
}
export async function resendRegistrationPhoneOtp(formData:FormData){
  const email=String(formData.get("email")??"").trim().toLowerCase(), key=process.env.SUPABASE_SERVICE_ROLE_KEY, url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!email||!key||!url) redirect("/register?error=invalid");
  const {createClient:adminClient}=await import("@supabase/supabase-js");
  const admin=adminClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:challenge}=await admin.from("phone_verification_challenges").select("user_id,email,phone").eq("email",email).maybeSingle();
  if(!challenge) redirect("/register?error=invalid");
  try { await createAndSendPhoneOtp(challenge.user_id,challenge.email,challenge.phone); }
  catch { redirect(`/verify-phone?email=${encodeURIComponent(email)}&error=sms`); }
  redirect(`/verify-phone?email=${encodeURIComponent(email)}&success=resent`);
}