"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BellAlertControl from "@/components/alerts/BellAlertControl";
import { useAlertSound, useKeepAwake, useRepeat } from "@/components/alerts/useAlertSound";

type IncomingOrder = { id: string; order_number: string | null; merchant_id: string };
type OrderRow = IncomingOrder & { status: string };
type Snapshot = Record<string, { status: string; sig: string }>;
type DeliveryUpdate = { key: string; orderNumber: string; message: string };

// Changes made by riders or the system. The store's own steps (accept, preparing, ready) refresh the list silently.
const deliveryMessages: Record<string, string> = {
  assigned: "A rider took this order and is heading to your store.",
  picked_up: "The rider picked up this order.",
  in_transit: "The rider is on the way to the customer.",
  delivered: "This order was delivered to the customer.",
  cancelled: "This order was cancelled.",
};

export default function MerchantNewOrderAlert({ merchantIds, snapshot }: { merchantIds: string[]; snapshot: Snapshot }) {
  const router = useRouter();
  const sound = useAlertSound("/notifications/merchantnotification.mp3");
  const [queue, setQueue] = useState<IncomingOrder[]>([]);
  const [updates, setUpdates] = useState<DeliveryUpdate[]>([]);
  const [channelUp, setChannelUp] = useState(false);
  const [pollOk, setPollOk] = useState(false);
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; });
  const statusRef = useRef<Record<string, string>>({});
  const seenRef = useRef<Set<string>>(new Set());
  // Seed from the exact server-rendered rows. This catches changes between SSR and the first poll.
  const sigRef = useRef<Record<string, string>>({});
  const seededRef = useRef(false);
  if (!seededRef.current) {
    seededRef.current = true;
    for (const [id, value] of Object.entries(snapshot)) {
      sigRef.current[id] = value.sig;
      statusRef.current[id] = value.status;
      if (value.status === "pending_merchant") seenRef.current.add(id);
    }
  }
  const refreshTimerRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  // Stable key: the array prop changes identity on every refresh, the ids do not.
  const idsKey = merchantIds.slice().sort().join(",");

  // Coalesce bursts of realtime and polling events into one server refresh.
  const refreshSoon = useCallback(() => {
    if (refreshTimerRef.current !== null) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      router.refresh();
    }, 400);
  }, [router]);

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
    const message = deliveryMessages[row.status];
    if (!message) return;
    setUpdates(current => [{ key: `${row.id}:${row.status}`, orderNumber: row.order_number || "Order", message }, ...current.filter(item => item.key !== `${row.id}:${row.status}`)].slice(0, 6));
    const s = soundRef.current;
    s.chime();
    window.setTimeout(() => s.speak(`${row.order_number ? "Order " + row.order_number + ". " : ""}${message}`), 600);
    s.vibrate([150, 80, 150]);
  }, []);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (!ids.length) return;
    const supabase = createClient();
    const filter = ids.length === 1 ? `merchant_id=eq.${ids[0]}` : `merchant_id=in.(${ids.join(",")})`;

    // updated_at changes for rider claims, on-the-way confirmation, payment updates,
    // expiry, and delivery transitions even when orders.status remains unchanged.
    const checkPending = async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id,order_number,merchant_id,status,updated_at")
          .in("merchant_id", ids)
          .order("placed_at", { ascending: false })
          .limit(100);
        if (error || !data) { setPollOk(false); return; }
        setPollOk(true);
        let needsRefresh = false;
        for (const row of [...data].reverse() as (OrderRow & { updated_at: string })[]) {
          const known = sigRef.current[row.id];
          if (row.status === "pending_merchant" && !seenRef.current.has(row.id)) push(row);
          trackStatus(row);
          if (known !== row.updated_at) {
            sigRef.current[row.id] = row.updated_at;
            needsRefresh = true;
          }
        }
        if (needsRefresh) refreshSoon();
      } finally {
        pollInFlightRef.current = false;
      }
    };

    // Keep Realtime authorised after initial load and token refreshes; merchant RLS depends on auth.uid().
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    const channel = supabase
      .channel(`merchant-new-orders-${idsKey.replace(/,/g, "-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter }, payload => {
        const row = payload.new as IncomingOrder;
        if (row && ids.includes(row.merchant_id)) { push(row); refreshSoon(); }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter }, payload => {
        const row = payload.new as OrderRow;
        if (row?.id && row.status && ids.includes(row.merchant_id)) { trackStatus(row); sigRef.current[row.id] = (payload.new as { updated_at?: string }).updated_at ?? sigRef.current[row.id]; refreshSoon(); }
      })
      .subscribe(status => { const connected = status === "SUBSCRIBED"; setChannelUp(connected); if (connected) void checkPending(); });

    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void checkPending(); }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkPending(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      authSub.subscription.unsubscribe();
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [idsKey, push, trackStatus, refreshSoon]);

  const live = channelUp && pollOk;
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
    <section aria-live="polite" className="min-w-0 space-y-2">
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
