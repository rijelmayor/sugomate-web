"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SoundToggle from "@/components/alerts/SoundToggle";
import { useAlertSound, useKeepAwake, useRepeat } from "@/components/alerts/useAlertSound";

// Rings a loud alarm (with voice and vibration) while a delivery offer is waiting for the rider.
// The ringing state comes from the server list of offered orders, so it stops by itself
// the moment the rider accepts or declines.
export default function DriverOfferAlarm({ userId, offeredIds }: { userId: string; offeredIds: string[] }) {
  const router = useRouter();
  const sound = useAlertSound();
  const [silenced, setSilenced] = useState<Set<string>>(new Set());
  const liveRef = useRef(false);

  const ringingIds = offeredIds.filter(id => !silenced.has(id));
  const ringing = ringingIds.length > 0;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`driver-offers-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `driver_user_id=eq.${userId}` }, () => router.refresh())
      .subscribe(status => { liveRef.current = status === "SUBSCRIBED"; });
    // Fallback poll only if the live connection is down, so riders never miss an offer.
    const timer = window.setInterval(() => { if (!liveRef.current && document.visibilityState === "visible") router.refresh(); }, 20000);
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(channel); };
  }, [userId, router]);

  useRepeat(ringing && sound.enabled, () => { sound.alarmBeep(); sound.vibrate([300, 150, 300, 150, 500]); }, 1500);
  useRepeat(ringing && sound.enabled, () => sound.speak("New delivery request. Please accept or decline."), 9000);
  useKeepAwake(sound.enabled);

  return <section aria-live="assertive" className="mt-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="min-w-0"><p className="font-extrabold text-[#102e57]">Delivery request alarm</p><p className="mt-1 text-sm text-slate-500">{sound.enabled ? "Alarm and voice are on. Keep this page open while you are online." : "Turn this on so a loud alarm rings when a delivery is offered to you."}</p></div>
      <SoundToggle sound={sound} label="delivery alarm" testMessage="New delivery request. Please accept or decline." />
    </div>
    {ringing && <div role="alert" className="animate-pulse rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 shadow-lg sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-rose-500 text-white"><BellRing size={22} aria-hidden="true" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-rose-700">New delivery request</p><p className="text-lg font-black text-[#102e57]">{ringingIds.length > 1 ? `${ringingIds.length} deliveries are waiting for you` : "A delivery is waiting for you"}</p></div></div>
        {sound.enabled && <button type="button" onClick={() => setSilenced(current => new Set([...current, ...ringingIds]))} className="min-h-11 rounded-xl bg-rose-600 px-5 py-2 text-sm font-black text-white transition active:scale-[.97]">Stop alarm</button>}
      </div>
      <p className="mt-2 text-xs text-rose-800">Review the offer below and tap Accept delivery or Decline offer.</p>
    </div>}
  </section>;
}
