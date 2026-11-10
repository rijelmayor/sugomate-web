import { NextResponse } from "next/server";
import { walletAdminContext, createWalletOtp, walletOtpHash, sendWalletSms } from "@/lib/wallet-server";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user, admin } = await walletAdminContext();
    const { requestId } = await request.json();
    if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) return NextResponse.json({ error: "Invalid top-up request." }, { status: 400 });
    const { data: topup, error } = await admin.from("wallet_top_up_requests").select("id,amount,status,customer_id").eq("id", requestId).maybeSingle();
    if (error || !topup || topup.status !== "pending_review") return NextResponse.json({ error: "This customer request is not awaiting approval." }, { status: 409 });
    const phone = process.env.SUGOMATE_ADMIN_AUTH_PHONE;
    if (!phone || !/^\+639\d{9}$/.test(phone)) return NextResponse.json({ error: "Admin authorization phone is not configured in E.164 format." }, { status: 503 });
    const { data: previous } = await admin.from("wallet_authorization_challenges").select("resend_available_at").eq("top_up_request_id", requestId).is("consumed_at", null).maybeSingle();
    if (previous && new Date(previous.resend_available_at).getTime() > Date.now()) return NextResponse.json({ error: "Please wait before requesting another OTP." }, { status: 429 });
    if (previous) await admin.from("wallet_authorization_challenges").update({ consumed_at: new Date().toISOString() }).eq("top_up_request_id", requestId).is("consumed_at", null);
    const code = createWalletOtp();
    const now = Date.now();
    const { error: insertError } = await admin.from("wallet_authorization_challenges").insert({
      top_up_request_id: requestId, otp_hash: walletOtpHash(requestId, code),
      expires_at: new Date(now + 10 * 60_000).toISOString(),
      resend_available_at: new Date(now + 60_000).toISOString(),
      attempts: 0, created_by: user.id
    });
    if (insertError) throw insertError;
    await admin.from("wallet_top_up_requests").update({ status: "otp_pending" }).eq("id", requestId).eq("status", "pending_review");
    try {
      await sendWalletSms(phone, `SUGOMATE AUTHORIZATION: Customer top-up request ${requestId.slice(0,8)} amount ₱${Number(topup.amount).toFixed(2)} requires approval. OTP: ${code}. Valid for 10 minutes. Do not share this code.`);
    } catch (smsError) {
      await admin.from("wallet_authorization_challenges").update({ consumed_at: new Date().toISOString() }).eq("top_up_request_id", requestId).is("consumed_at", null);
      await admin.from("wallet_top_up_requests").update({ status: "pending_review" }).eq("id", requestId).eq("status", "otp_pending");
      throw smsError;
    }
    await admin.from("wallet_audit_events").insert({ actor_user_id: user.id, actor_role: "admin", event_type: "topup_otp_sent", entity_type: "top_up_request", entity_id: requestId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send authorization OTP.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}