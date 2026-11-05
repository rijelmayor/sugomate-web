"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SoundToggle from "@/components/alerts/SoundToggle";
import { useAlertSound, useKeepAwake, useRepeat } from "@/components/alerts/useAlertSound";

type IncomingOrder = { id: string; order_number: string | null; merchant_id: string };
type OrderRow = IncomingOrder & { status: string };
type DeliveryUpdate = { key: string; orderNumber: string; message: string };

// Changes made by riders or the system. The store's own steps (accept, preparing, ready) refresh the list silently.
const deliveryMessages: Record<string, string> = {
  assigned: "A rider took this order and is heading to your store.",
  picked_up: "The rider picked up this order.",
  in_transit: "The rider is on the way to the customer.",
  delivered: "This order was delivered to the customer.",
  cancelled: "This order was cancelled.",
};

export default function MerchantNewOrderAlert({ merchantIds }: { merchantIds: string[] }) {
  const router = useRouter();
  const sound = useAlertSound();
  const [queue, setQueue] = useState<IncomingOrder[]>([]);
  const [updates, setUpdates] = useState<DeliveryUpdate[]>([]);
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; });
  const statusRef = useRef<Record<string, string>>({});
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  // Stable key: the array prop changes identity on every refresh, the ids do not.
  const idsKey = merchantIds.slice().sort().join(",");

  const acknowledge = useCallback(() => setQueue(current => current.slice(1)), []);
  const push = useCallback((row: IncomingOrder) => {
    if (!row?.id || seenRef.current.has(row.id)) return;
    seenRef.current.add(row.id);
    statusRef.current[row.id] = "pending_merchant";
    setQueue(current => [...current, row]);
    router.refresh(); // show the new order in the list straight away
  }, [router]);

  // Compares against the last known status, so a status change is announced once whether it arrives live or on catch-up.
  const trackStatus = useCallback((row: OrderRow) => {
    const prev = statusRef.current[row.id];
    statusRef.current[row.id] = row.status;
    if (prev === undefined || prev === row.status) return;
    router.refresh();
    const message = deliveryMessages[row.status];
    if (!message) return;
    setUpdates(current => [{ key: `${row.id}:${row.status}`, orderNumber: row.order_number || "Order", message }, ...current.filter(item => item.key !== `${row.id}:${row.status}`)].slice(0, 6));
    const s = soundRef.current;
    s.chime();
    window.setTimeout(() => s.speak(`${row.order_number ? "Order " + row.order_number + ". " : ""}${message}`), 600);
    s.vibrate([150, 80, 150]);
  }, [router]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (!ids.length) return;
    const supabase = createClient();
    const filter = ids.length === 1 ? `merchant_id=eq.${ids[0]}` : `merchant_id=in.(${ids.join(",")})`;

    // Safety net: realtime can miss events (phone slept, network dropped), so also look for waiting orders.
    const checkPending = async () => {
      const { data } = await supabase.from("orders").select("id,order_number,merchant_id,status").in("merchant_id", ids).order("placed_at", { ascending: false }).limit(60);
      if (!data) return;
      const first = !primedRef.current;
      for (const row of [...data].reverse() as OrderRow[]) {
        if (row.status === "pending_merchant") {
          if (first) { seenRef.current.add(row.id); statusRef.current[row.id] = row.status; } else push(row);
        }
        trackStatus(row);
        if (first) statusRef.current[row.id] = row.status;
      }
      primedRef.current = true;
    };

    const channel = supabase
      .channel(`merchant-new-orders-${idsKey.replace(/,/g, "-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter }, payload => {
        const row = payload.new as IncomingOrder;
        if (row && ids.includes(row.merchant_id)) push(row);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter }, payload => {
        const row = payload.new as OrderRow;
        if (row?.id && row.status && ids.includes(row.merchant_id)) trackStatus(row);
      })
      .subscribe(status => { if (status === "SUBSCRIBED") void checkPending(); });

    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void checkPending(); }, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkPending(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(channel); };
  }, [idsKey, push, trackStatus]);

  const ringing = queue.length > 0 && sound.enabled;
  // Chime plus a spoken "New order received" until the store confirms.
  useRepeat(ringing, () => {
    sound.chime();
    window.setTimeout(() => sound.speak(queue.length > 1 ? `You have ${queue.length} new orders.` : "New order received."), 700);
  }, 7000);
  useKeepAwake(sound.enabled);

  // Flash the tab title so a waiting order is noticed even from another tab.
  useEffect(() => {
    if (!queue.length) return;
    const original = document.title;
    let flip = false;
    const timer = window.setInterval(() => { flip = !flip; document.title = flip ? "🔔 NEW ORDER!" : original; }, 1000);
    return () => { window.clearInterval(timer); document.title = original; };
  }, [queue.length]);

  if (!merchantIds.length) return null;

  return (
    <section aria-live="polite" className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <p className="font-extrabold text-[#102e57]">New order sound and voice alerts</p>
          <p className="mt-1 text-sm text-slate-500">{sound.enabled ? "Your store will chime and announce “New order received” until you confirm. Keep this page open." : "Enable sound so incoming orders alert your store."}</p>
        </div>
        <SoundToggle sound={sound} label="order alerts" testMessage="New order received." />
      </div>

      {updates.length > 0 && (
        <div role="status" className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sky-800">Delivery updates</p>
            <button type="button" onClick={() => setUpdates([])} className="text-xs font-bold text-sky-800 underline">Dismiss all</button>
          </div>
          <ul className="mt-2 space-y-1.5">{updates.map(item => <li key={item.key} className="text-sm text-[#102e57]"><strong>{item.orderNumber}</strong> · {item.message}</li>)}</ul>
        </div>
      )}

      {queue.length > 0 && (
        <div role="alert" className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 shadow-md sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-orange-700">Incoming order</p>
              <h2 className="mt-1 text-xl font-black text-[#102e57]">{queue[0].order_number || "New customer order"}</h2>
              <p className="mt-1 text-sm text-slate-600">{queue.length > 1 ? `${queue.length} new orders are waiting for acknowledgement.` : "A customer has just placed an order with your store."}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-200 px-3 py-1.5 text-xs font-extrabold text-orange-900"><span className="h-2 w-2 animate-pulse rounded-full bg-orange-700" /> Needs acknowledgement</span>
          </div>
          {!sound.enabled && <p className="mt-3 text-sm font-semibold text-orange-900">Tap “Enable order alerts” above to hear the chime and voice. The visual alert stays visible.</p>}
          <button type="button" onClick={acknowledge} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ffbd18] px-5 py-3 text-sm font-black text-[#102e57] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#ffd04a] hover:shadow-md active:translate-y-0 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102e57] focus-visible:ring-offset-2"><span aria-hidden="true">✓</span> Confirm order received</button>
          <p className="mt-2 text-xs text-slate-500">This only silences and acknowledges the alert. You must still Accept or Reject the order below.</p>
        </div>
      )}
    </section>
  );
}
