"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminDispatchLiveRefresh() {
  const router = useRouter();
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting">("connecting");

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 350);
    };

    const channel = supabase
      .channel("admin-dispatch-live-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("reconnecting");
        }
      });

    // Safety net: refresh even if a websocket event is missed or temporarily disconnected.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);

    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className="mb-3 flex items-center justify-end gap-2 text-[11px] font-semibold" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${connection === "live" ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" : connection === "connecting" ? "bg-amber-400" : "bg-red-400"}`} />
      <span className={connection === "live" ? "text-emerald-300" : connection === "connecting" ? "text-amber-300" : "text-red-300"}>
        {connection === "live" ? "Live database connection" : connection === "connecting" ? "Connecting to live updates…" : "Reconnecting · 20s refresh fallback active"}
      </span>
    </div>
  );
}
