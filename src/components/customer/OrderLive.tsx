"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SoundToggle from "@/components/alerts/SoundToggle";
import { useAlertSound } from "@/components/alerts/useAlertSound";

const announcements: Record<string, string> = {
  accepted: "Your order was accepted by the store.",
  preparing: "Your order is being prepared.",
  ready_for_pickup: "Your order is ready and waiting for a rider.",
  assigned: "A rider has been assigned to your order.",
  picked_up: "Your rider picked up your order.",
  in_transit: "Your order is on the way.",
  delivered: "Your order was delivered. Enjoy!",
  rejected: "Sorry, the store could not accept your order.",
  cancelled: "Your order was cancelled.",
};

// Keeps the orders page current and, with sound on, announces each status change.
export default function OrderLive({ userId, hasActive, statuses }: { userId: string; hasActive: boolean; statuses: Record<string, string> }) {
  const router = useRouter();
  const sound = useAlertSound();
  const { chime, speak } = sound;
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  const statusRef = useRef<Record<string, string>>(statuses);
  // Always compare against what the page last rendered, so a refresh never repeats an announcement.
  useEffect(() => { statusRef.current = statuses; });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${userId}` }, payload => {
        const row = payload.new as { id?: string; status?: string };
        if (row?.id && row.status && statusRef.current[row.id] && statusRef.current[row.id] !== row.status) {
          statusRef.current = { ...statusRef.current, [row.id]: row.status };
          const message = announcements[row.status];
          if (message) { chime(); window.setTimeout(() => speak(message), 600); }
        }
        router.refresh();
      })
      .subscribe(status => { const ok = status === "SUBSCRIBED"; liveRef.current = ok; setLive(ok); });
    return () => { void supabase.removeChannel(channel); };
  }, [userId, router, chime, speak]);

  // Fallback poll only when the live connection is down and an order is still active.
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => { if (!liveRef.current && document.visibilityState === "visible") router.refresh(); }, 45000);
    return () => window.clearInterval(timer);
  }, [hasActive, router]);

  if (!hasActive) return null;
  return <div className="flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700"><span className={`h-2 w-2 rounded-full bg-emerald-500 ${live ? "animate-pulse" : "opacity-50"}`} />Live updates</span>
    <SoundToggle sound={sound} label="order sound" testMessage="Order updates will be announced." />
  </div>;
}
