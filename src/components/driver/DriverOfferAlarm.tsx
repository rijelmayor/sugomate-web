"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BellAlertControl from "@/components/alerts/BellAlertControl";
import { useAlertSound, useKeepAwake, useRepeat } from "@/components/alerts/useAlertSound";

// Keeps the driver order board live and rings for direct dispatch offers.
// The ringing state comes from the server list of offered orders, so it stops by itself
// the moment the rider accepts or declines.
export default function DriverOfferAlarm({ userId, offeredIds, availableIds }: { userId: string; offeredIds: string[]; availableIds: string[] }) {
  const router = useRouter();
  const sound = useAlertSound("/notifications/drivernotification.mp3");
  const [silenced, setSilenced] = useState<Set<string>>(new Set());
  const [newAvailableIds, setNewAvailableIds] = useState<string[]>([]);
  const previousAvailableRef = useRef<Set<string>>(new Set(availableIds));
  const availableKey = availableIds.join("|");
  const liveRef = useRef(false);
  const [live, setLive] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const currentAvailableIds = availableKey ? availableKey.split("|") : [];
    const previous = previousAvailableRef.current;
    const newlyAvailable = currentAvailableIds.filter(id => !previous.has(id));
    previousAvailableRef.current = new Set(currentAvailableIds);
    setNewAvailableIds(current => [...new Set([...current.filter(id => currentAvailableIds.includes(id)), ...newlyAvailable])]);
    if (newlyAvailable.length) setSilenced(current => { const next = new Set(current); newlyAvailable.forEach(id => next.delete(id)); return next; });
  }, [availableKey]);

  const ringingIds = [...offeredIds, ...newAvailableIds].filter(id => !silenced.has(id));
  const ringing = ringingIds.length > 0;

  useEffect(() => {
    const supabase = createClient();
    const refreshOnce = () => {
      // Coalesce bursts of row changes into one server refresh.
      if (refreshTimer.current !== null) return;
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        if (document.visibilityState === "visible") router.refresh();
      }, 500);
    };
    const channel = supabase
      .channel(`driver-offers-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, payload => {
        // Always refresh: merchant cancellation clears driver_user_id, so filtering by the new row misses it.
        refreshOnce();
      })
      .subscribe(status => { const connected = status === "SUBSCRIBED"; liveRef.current = connected; setLive(connected); if (connected) refreshOnce(); });
    // Realtime plus a light foreground safety poll catches events hidden by RLS or cleared rider assignment.
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refreshOnce(); }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshOnce(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  useRepeat(ringing && sound.enabled, () => { sound.alarmBeep(); sound.vibrate([300, 150, 300, 150, 500]); }, 1500);
  useRepeat(ringing && sound.enabled, () => sound.speak("New delivery order available. Check the order board."), 9000);
  useKeepAwake(sound.enabled);

  return <section aria-live="assertive" className="min-w-0 space-y-2">
    <div className="flex items-center justify-between gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700`}><span className={`h-2 w-2 rounded-full bg-emerald-500 ${live ? "animate-pulse" : "opacity-50"}`} />{live ? "Live updates" : "Reconnecting…"}</span><BellAlertControl sound={sound} label="delivery alarm" testMessage="New delivery request. Please accept or decline." /></div>
    {ringing && <div role="alert" className="animate-pulse rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 shadow-lg sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-rose-500 text-white"><BellRing size={22} aria-hidden="true" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-rose-700">New delivery request</p><p className="text-lg font-black text-[#102e57]">{ringingIds.length > 1 ? `${ringingIds.length} deliveries are waiting for you` : "A delivery is waiting for you"}</p></div></div>
        {sound.enabled && <button type="button" onClick={() => setSilenced(current => new Set([...current, ...ringingIds]))} className="min-h-11 rounded-xl bg-rose-600 px-5 py-2 text-sm font-black text-white transition active:scale-[.97]">Stop alarm</button>}
      </div>
      <p className="mt-2 text-xs text-rose-800">Review the available orders and claim one if you want it. Direct dispatch offers can be accepted or declined.</p>
    </div>}
  </section>;
}
