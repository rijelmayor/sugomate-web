"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Keeps the orders list current. Sound and voice now live in the NotificationBell so an update is announced once, on every customer page.
export default function OrderLive({ userId, hasActive }: { userId: string; hasActive: boolean }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${userId}` }, () => router.refresh())
      .subscribe(status => { const ok = status === "SUBSCRIBED"; liveRef.current = ok; setLive(ok); });
    return () => { void supabase.removeChannel(channel); };
  }, [userId, router]);

  useEffect(() => {
    if (!hasActive) return;
    // Keep a short foreground safety refresh even when Realtime reports SUBSCRIBED; a healthy channel can still miss row events under RLS or transient network conditions.
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [hasActive, router]);

  if (!hasActive) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700"><span className={`h-2 w-2 rounded-full bg-emerald-500 ${live ? "animate-pulse" : "opacity-50"}`} />{live ? "Live updates" : "Reconnecting…"}</span>;
}
