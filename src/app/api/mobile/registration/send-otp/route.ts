import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAndSendPhoneOtp, normalizePhilippineMobile } from "@/lib/phone-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = String(body.userId ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    if (!userId || !email || !normalizePhilippineMobile(phone)) {
      return NextResponse.json({ error: "Enter a valid name, email and Philippine mobile number." }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Registration verification is temporarily unavailable." }, { status: 503 });
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user || data.user.email?.toLowerCase() !== email) {
      return NextResponse.json({ error: "Registration could not be verified. Please try again." }, { status: 403 });
    }
    const metadataPhone = normalizePhilippineMobile(String(data.user.user_metadata?.phone ?? ""));
    if (metadataPhone !== normalizePhilippineMobile(phone)) {
      return NextResponse.json({ error: "The mobile number does not match the registration details." }, { status: 403 });
    }
    await createAndSendPhoneOtp(userId, email, phone);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send verification code.";
    return NextResponse.json({ error: message }, { status: 429 });
  }
}
