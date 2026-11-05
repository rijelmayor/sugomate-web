"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Keeps the orders page current: refreshes when one of the customer's orders changes,
// with a slow poll as a fallback while any order is still active.
export default function OrderLive({ userId, hasActive }: { userId: string; hasActive: boolean }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${userId}` }, () => router.refresh())
      .subscribe(status => setLive(status === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(channel); };
  }, [userId, router]);

  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 30000);
    return () => window.clearInterval(timer);
  }, [hasActive, router]);

  if (!hasActive) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700"><span className={`h-2 w-2 rounded-full bg-emerald-500 ${live ? "animate-pulse" : "opacity-50"}`} />Live updates</span>;
}
