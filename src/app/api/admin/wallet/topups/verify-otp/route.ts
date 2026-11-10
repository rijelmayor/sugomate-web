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
    const { data: challenge, error } = await admin.from("wallet_authorization_challenges")
      .select("id,otp_hash,expires_at,attempts,consumed_at").eq("top_up_request_id", requestId).is("consumed_at", null).maybeSingle();
    if (error || !challenge) return NextResponse.json({ error: "No active authorization request. Send a new OTP." }, { status: 404 });
    if (new Date(challenge.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "OTP expired. Send a new code." }, { status: 400 });
    if (challenge.attempts >= 5) return NextResponse.json({ error: "OTP locked after five incorrect attempts." }, { status: 429 });
    if (!safeOtpCompare(challenge.otp_hash, walletOtpHash(requestId, code))) {
      await admin.from("wallet_authorization_challenges").update({ attempts: challenge.attempts + 1 }).eq("id", challenge.id).eq("attempts", challenge.attempts);
      return NextResponse.json({ error: "Incorrect OTP." }, { status: 400 });
    }
    const { data: topup } = await admin.from("wallet_top_up_requests").select("id,customer_id,amount,status").eq("id", requestId).maybeSingle();
    if (!topup || topup.status !== "otp_pending") return NextResponse.json({ error: "Top-up is no longer awaiting authorization." }, { status: 409 });
    const { data: transactionId, error: creditError } = await admin.rpc("wallet_admin_credit_topup", { p_request_id: requestId, p_admin_id: user.id });
    if (creditError) throw creditError;
    await admin.from("wallet_authorization_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", challenge.id).is("consumed_at", null);
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