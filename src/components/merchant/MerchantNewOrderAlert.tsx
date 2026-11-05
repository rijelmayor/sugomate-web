"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BellAlertControl from "@/components/alerts/BellAlertControl";
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
  const [live, setLive] = useState(false);
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
  }, []);

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
      let needsRefresh = false;
      for (const row of [...data].reverse() as OrderRow[]) {
        const previousStatus = statusRef.current[row.id];
        if (row.status === "pending_merchant") {
          if (first) { seenRef.current.add(row.id); statusRef.current[row.id] = row.status; }
          else if (!seenRef.current.has(row.id)) { push(row); needsRefresh = true; }
        }
        if (previousStatus !== undefined && previousStatus !== row.status) needsRefresh = true;
        trackStatus(row);
        if (first) statusRef.current[row.id] = row.status;
      }
      primedRef.current = true;
      // Refresh server-rendered cards only when an order actually changed.
      if (needsRefresh) router.refresh();
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
      .subscribe(status => { const connected = status === "SUBSCRIBED"; setLive(connected); if (connected) void checkPending(); });

    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void checkPending(); }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkPending(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(channel); };
  }, [idsKey, push, trackStatus, router]);

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
    <section aria-live="polite" className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700`}><span className={`h-2 w-2 rounded-full bg-emerald-500 ${live ? "animate-pulse" : "opacity-50"}`} />{live ? "Live updates" : "Reconnecting…"}</span><BellAlertControl sound={sound} label="merchant alerts" testMessage="New order received." /></div>

      {updates.length > 0 && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-2.5">
          <ul className="min-w-0 space-y-1">{updates.slice(0, 3).map(item => <li key={item.key} className="text-sm text-[#102e57]"><strong>{item.orderNumber}</strong> · {item.message}</li>)}</ul>
          <button type="button" onClick={() => setUpdates([])} className="shrink-0 text-xs font-bold text-sky-800 underline">Dismiss</button>
        </div>
      )}

      {queue.length > 0 && (
        <div role="alert" className="animate-fade-in fixed inset-x-3 top-3 z-50 mx-auto max-w-xl rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff8a00] text-white"><Bell size={21} className="animate-pulse" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider text-orange-700">{queue.length > 1 ? `${queue.length} new orders waiting` : "New order"}</p>
              <p className="truncate text-lg font-black text-[#102e57]">{queue[0].order_number || "New customer order"}</p>
            </div>
          </div>
          {!sound.enabled && <p className="mt-2 text-xs font-semibold text-orange-900">Sound is off. Turn it on from the bell settings to hear new orders.</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { acknowledge(); router.push("/merchant?tab=new"); }} className="min-h-11 rounded-xl border border-orange-200 bg-white px-3 text-sm font-bold text-[#102e57] transition active:scale-[.97]">Review order</button>
            <button type="button" onClick={acknowledge} className="min-h-11 rounded-xl bg-[#ffbd18] px-3 text-sm font-black text-[#102e57] shadow-sm transition hover:bg-[#ffd04a] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102e57] focus-visible:ring-offset-2">✓ Confirm received</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Confirming only silences the alert. You still need to accept or reject the order.</p>
        </div>
      )}
    </section>
  );
}
