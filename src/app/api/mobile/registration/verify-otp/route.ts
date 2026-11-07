import { NextResponse } from "next/server";
import { verifyPhoneOtp } from "@/lib/phone-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").trim();
    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter the six-digit verification code." }, { status: 400 });
    }
    const result = await verifyPhoneOtp(email, code);
    if (!result.ok) {
      const messages: Record<string, string> = {
        invalid: "That code is incorrect. You have up to five attempts.",
        expired: "Your code has expired. Request a new one.",
        locked: "Too many incorrect attempts. Request a new code after the cooldown.",
        missing: "No active verification request was found. Please register again.",
        save: "We couldn't save your verification. Please try again.",
      };
      return NextResponse.json({ error: messages[result.reason] ?? "Verification failed." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Verification is temporarily unavailable." }, { status: 503 });
  }
}
