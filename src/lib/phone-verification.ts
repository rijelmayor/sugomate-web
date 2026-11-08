import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Phone verification is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function hashCode(userId: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Phone verification is not configured.");
  return createHmac("sha256", secret).update(userId + ":" + code).digest("hex");
}

export function normalizePhilippineMobile(input: string) {
  // Keep a leading +, strip spaces/punctuation/other non-digits
  let cleaned = input.trim();
  if (cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(1).replace(/\D/g, "");
  } else {
    cleaned = cleaned.replace(/\D/g, "");
  }

  // 09XXXXXXXXX (11 digits) → +639XXXXXXXXX
  if (/^09\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(1);
  // 9XXXXXXXXX (10 digits) → +639XXXXXXXXX
  if (/^9\d{9}$/.test(cleaned)) return "+63" + cleaned;
  // 639XXXXXXXXX (12 digits, no +) → +639XXXXXXXXX
  if (/^639\d{9}$/.test(cleaned)) return "+" + cleaned;
  // +639XXXXXXXXX
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
  // +6309XXXXXXXXX (common mistake of keeping the 0) → +639XXXXXXXXX
  if (/^\+6309\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(4);
  return null;
}

export async function createAndSendPhoneOtp(userId: string, email: string, rawPhone: string) {
  const phone = normalizePhilippineMobile(rawPhone);
  if (!phone) throw new Error("Enter a valid Philippine mobile number.");
  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) throw new Error("SMS delivery is not configured (missing TEXTBEE_API_KEY).");
  const supabase = adminClient();
  const { data: previous } = await supabase.from("phone_verification_challenges")
    .select("last_sent_at").eq("user_id", userId).maybeSingle();
  if (previous && Date.now() - new Date(previous.last_sent_at).getTime() < 60_000) {
    throw new Error("Please wait 60 seconds before requesting another code.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const { error } = await supabase.from("phone_verification_challenges").upsert({
    user_id: userId,
    email: email.toLowerCase(),
    phone,
    code_hash: hashCode(userId, code),
    attempts: 0,
    expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    last_sent_at: now.toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error("Unable to prepare your verification code.");

  const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      recipients: [phone],
      message: `Your SUGOMATE verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
    }),
    cache: "no-store",
  });
  const bodyText = await response.text();
  let result: { data?: { success?: boolean; failureCount?: number; message?: string } } = {};
  try { result = JSON.parse(bodyText); } catch { /* non-json */ }
  if (!response.ok) {
    console.error("[textbee] send failed", response.status, bodyText.slice(0, 500));
    throw new Error("We couldn't send your SMS. Please try again shortly.");
  }
  if (result.data?.success === false || (result.data?.failureCount ?? 0) > 0) {
    console.error("[textbee] queue failed", bodyText.slice(0, 500));
    throw new Error("Textbee could not queue your SMS. Please try again.");
  }
}

export async function verifyPhoneOtp(email: string, submittedCode: string) {
  if (!/^\d{6}$/.test(submittedCode)) return { ok: false as const, reason: "invalid" };
  const supabase = adminClient();
  const { data: challenge, error } = await supabase.from("phone_verification_challenges")
    .select("user_id,phone,code_hash,attempts,expires_at").eq("email", email.toLowerCase()).maybeSingle();
  if (error || !challenge) return { ok: false as const, reason: "missing" };
  if (new Date(challenge.expires_at).getTime() <= Date.now()) return { ok: false as const, reason: "expired" };
  if (challenge.attempts >= 5) return { ok: false as const, reason: "locked" };

  const expected = Buffer.from(challenge.code_hash, "hex");
  const actual = Buffer.from(hashCode(challenge.user_id, submittedCode), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await supabase.from("phone_verification_challenges")
      .update({ attempts: challenge.attempts + 1 }).eq("user_id", challenge.user_id);
    return { ok: false as const, reason: "invalid" };
  }

  const { error: profileError } = await supabase.from("profiles")
    .update({ phone: challenge.phone, phone_verified_at: new Date().toISOString() }).eq("id", challenge.user_id);
  if (profileError) return { ok: false as const, reason: "save" };

  // Mobile verification is SUGOMATE's active registration verification method.
  // Confirm the Auth email administratively only after the OTP has been validated,
  // so an email link is not required for the user to sign in.
  const { error: authError } = await supabase.auth.admin.updateUserById(challenge.user_id, {
    email_confirm: true,
  });
  if (authError) {
    console.error("[phone-verification] unable to mark email optional after phone verification", authError.message);
    return { ok: false as const, reason: "save" };
  }

  await supabase.from("phone_verification_challenges").delete().eq("user_id", challenge.user_id);
  return { ok: true as const };
}
