"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type IncomingOrder = {
  id: string;
  order_number: string | null;
  merchant_id: string;
};

export default function MerchantNewOrderAlert({ merchantIds }: { merchantIds: string[] }) {
  const [queue, setQueue] = useState<IncomingOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundUnavailable, setSoundUnavailable] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const acknowledge = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  const enableSound = useCallback(async () => {
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) {
        setSoundUnavailable(true);
        return;
      }
      const context = audioRef.current ?? new AudioContextConstructor();
      audioRef.current = context;
      await context.resume();
      setSoundEnabled(true);
      setSoundUnavailable(false);
    } catch {
      setSoundUnavailable(true);
    }
  }, []);

  useEffect(() => {
    if (!merchantIds.length) return;
    const supabase = createClient();
    const filter = merchantIds.length === 1
      ? `merchant_id=eq.${merchantIds[0]}`
      : `merchant_id=in.(${merchantIds.join(",")})`;

    const channel = supabase
      .channel(`merchant-new-orders-${merchantIds.slice().sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter },
        (payload) => {
          const row = payload.new as IncomingOrder;
          if (!row?.id || !merchantIds.includes(row.merchant_id) || seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          setQueue((current) => [...current, row]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [merchantIds]);

  useEffect(() => {
    if (!soundEnabled || !queue.length) return;
    const context = audioRef.current;
    if (!context) return;

    const playChime = () => {
      if (context.state !== "running") return;
      const now = context.currentTime;
      [880, 1174].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * 0.18;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.34);
      });
    };

    playChime();
    const timer = window.setInterval(playChime, 1800);
    return () => window.clearInterval(timer);
  }, [queue, soundEnabled]);

  useEffect(() => () => {
    if (audioRef.current && audioRef.current.state !== "closed") {
      void audioRef.current.close();
    }
  }, []);

  if (!merchantIds.length) return null;

  return (
    <section aria-live="polite" className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <p className="font-extrabold text-[#102e57]">New order sound alerts</p>
          <p className="mt-1 text-sm text-slate-500">
            {soundEnabled ? "Sound is enabled for this session." : "Enable sound so incoming orders can alert your store."}
          </p>
        </div>
        {!soundEnabled ? (
          <button type="button" onClick={enableSound} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102e57] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#174777] hover:shadow-md active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">
            Enable sound alerts
          </button>
        ) : (
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Sound enabled
          </span>
        )}
      </div>

      {soundUnavailable && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This browser could not enable audio. Check the device sound settings or try another browser.</p>}

      {queue.length > 0 && (
        <div role="alert" className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 shadow-md sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-orange-700">Incoming order</p>
              <h2 className="mt-1 text-xl font-black text-[#102e57]">{queue[0].order_number || "New customer order"}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {queue.length > 1 ? `${queue.length} new orders are waiting for acknowledgement.` : "A customer has just placed an order with your store."}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-200 px-3 py-1.5 text-xs font-extrabold text-orange-900">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-700" /> Needs acknowledgement
            </span>
          </div>
          {!soundEnabled && <p className="mt-3 text-sm font-semibold text-orange-900">Tap “Enable sound alerts” above to hear the repeating chime. The visual alert will remain visible.</p>}
          <button type="button" onClick={acknowledge} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ffbd18] px-5 py-3 text-sm font-black text-[#102e57] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#ffd04a] hover:shadow-md active:translate-y-0 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102e57] focus-visible:ring-offset-2 sm:w-auto">
            <span aria-hidden="true">✓</span> Confirm order received
          </button>
          <p className="mt-2 text-xs text-slate-500">This only silences and acknowledges the alert. You must still Accept or Reject the order below.</p>
        </div>
      )}
    </section>
  );
}
