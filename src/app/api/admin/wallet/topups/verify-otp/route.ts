import { NextResponse } from "next/server";
import { walletAdminContext, walletOtpHash, safeOtpCompare, sendWalletSms } from "@/lib/wallet-server";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, admin } = await walletAdminContext();
    const body = await request.json();
    const requestId = String(body.requestId ?? "");
    const code = String(body.code ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the six-digit OTP for this top-up." }, { status: 400 });
    const { data: transactionId, error: creditError } = await admin.rpc("wallet_admin_verify_and_credit_topup", {
      p_request_id: requestId, p_admin_id: user.id, p_candidate_hash: walletOtpHash(requestId, code)
    });
    if (creditError) {
      const reason = creditError.message ?? "";
      const status = reason.includes("otp_locked") ? 429 : reason.includes("otp_expired") ? 410 : reason.includes("otp_missing") ? 404 : 400;
      return NextResponse.json({ error: reason.includes("otp_locked") ? "OTP locked after five incorrect attempts." : reason.includes("otp_expired") ? "OTP expired. Send a new code." : reason.includes("otp_missing") ? "No active authorization request. Send a new OTP." : "OTP is incorrect or this top-up is no longer pending." }, { status });
    }
    if (!transactionId) return NextResponse.json({ error: "OTP is incorrect. Check the code and try again." }, { status: 400 });
    const { data: topup } = await admin.from("wallet_top_up_requests").select("id,customer_id,amount,status").eq("id", requestId).maybeSingle();
    const [{ data: wallet }, { data: profile }] = await Promise.all([
      admin.from("customer_wallets").select("available_balance").eq("customer_id", topup.customer_id).single(),
      admin.from("profiles").select("phone").eq("id", topup.customer_id).maybeSingle()
    ]);
    if (profile?.phone) {
      try { await sendWalletSms(profile.phone, `SUGOMATE: Your wallet top-up of ₱${Number(topup.amount).toFixed(2)} was approved and credited. Updated wallet balance: ₱${Number(wallet?.available_balance ?? 0).toFixed(2)}. Thank you!`); }
      catch (smsError) { console.error("[wallet] customer confirmation SMS failed after successful credit", smsError); }
    }
    return NextResponse.json({ ok: true, transactionId, balance: wallet?.available_balance ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to authorize top-up.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}