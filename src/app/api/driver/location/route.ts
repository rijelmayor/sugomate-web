import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { lat?: number; lng?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { error } = await supabase.rpc("driver_ping_location", { p_lat: lat, p_lng: lng });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
