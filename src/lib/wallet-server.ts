import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function walletAdminContext() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) redirect("/dashboard?error=admin-access");
  return { user, db, admin: walletServiceClient() };
}

export async function walletCustomerContext() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "customer").maybeSingle();
  if (!role) redirect("/dashboard?error=customer-access");
  return { user, db };
}

export function walletServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Wallet service is not configured.");
  return createSupabaseAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function walletOtpHash(requestId: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Wallet authorization is not configured.");
  return createHmac("sha256", secret).update("wallet-topup:" + requestId + ":" + code).digest("hex");
}

export function createWalletOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function safeOtpCompare(expectedHex: string, actualHex: string) {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && expected.length > 0 && timingSafeEqual(expected, actual);
}

export async function sendWalletSms(phone: string, message: string) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) throw new Error("SMS delivery is not configured.");
  const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ recipients: [phone], message }),
    cache: "no-store",
  });
  const body = await response.text();
  let result: { data?: { success?: boolean; failureCount?: number } } = {};
  try { result = JSON.parse(body); } catch {}
  if (!response.ok || result.data?.success === false || (result.data?.failureCount ?? 0) > 0) {
    console.error("[wallet-textbee] delivery failed", response.status, body.slice(0, 400));
    throw new Error("TextBee could not queue the authorization SMS.");
  }
}
