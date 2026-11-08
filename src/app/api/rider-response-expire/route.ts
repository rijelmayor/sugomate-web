import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data, error } = await supabase.rpc("expire_rider_response_timeouts");
  if (error) return NextResponse.json({ error: "Could not process expired rider assignments." }, { status: 500 });
  return NextResponse.json({ expired: Number(data ?? 0) });
}
