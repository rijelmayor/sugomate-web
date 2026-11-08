"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AlertControlBar from "@/components/alerts/AlertControlBar";
import { useAlertSound } from "@/components/alerts/useAlertSound";

type Note = { id: string; orderNumber: string; message: string; at: number; read: boolean };

const messages: Record<string, string> = {
  accepted: "The store accepted your order.",
  preparing: "The store is preparing your order.",
  ready_for_pickup: "Your order is ready and waiting for a rider.",
  assigned: "A rider is on the way to pick up your order.",
  picked_up: "Your rider picked up your order.",
  in_transit: "Your order is on the way!",
  delivered: "Your order was delivered. Enjoy!",
  rejected: "Sorry, the store could not accept your order.",
  cancelled: "Your order was cancelled.",
  rider_reassigned: "Your rider is unavailable. SUGOMATE is arranging a replacement delivery partner.",
};
const MAX_NOTES = 30;

/** Customer notification bell: always visible, live over Supabase Realtime, remembers recent updates. */
export default function NotificationBell({ userId, ordersHref = "/customer/orders" }: { userId: string; ordersHref?: string }) {
  const sound = useAlertSound();
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; });
  const storageKey = `sugomate_notes_v1:${userId}`;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [ring, setRing] = useState(false);
  const liveRef = useRef(false);
  const known = useRef<Record<string, string>>({});
  const knownReassignments = useRef<Record<string, number>>({});
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const raw = window.localStorage.getItem(storageKey); if (raw) setNotes(JSON.parse(raw) as Note[]); } catch { /* ignore */ }
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(notes)); } catch { /* ignore */ }
  }, [notes, loaded, storageKey]);

  const notify = useCallback((orderId: string, orderNumber: string, status: string) => {
    const message = messages[status];
    if (!message) return;
    setNotes(current => [{ id: `${orderId}:${status}:${Date.now()}`, orderNumber, message, at: Date.now(), read: false }, ...current].slice(0, MAX_NOTES));
    setRing(true);
    window.setTimeout(() => setRing(false), 1600);
    const s = soundRef.current;
    s.chime();
    window.setTimeout(() => s.speak(message), 600);
    s.vibrate([120, 60, 120]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    // Seeds known statuses on connect, and catches up on anything missed while the phone slept or the network dropped.
    const sync = async () => {
      const { data } = await supabase.from("orders").select("id,order_number,status,rider_reassignment_count").eq("customer_id", userId).order("placed_at", { ascending: false }).limit(50);
      if (cancelled || !data) return;
      for (const row of data) {
        const prev = known.current[row.id];
        const reassignmentCount = Number(row.rider_reassignment_count ?? 0);
        const previousReassignmentCount = knownReassignments.current[row.id];
        known.current[row.id] = row.status;
        knownReassignments.current[row.id] = reassignmentCount;
        if (previousReassignmentCount !== undefined && reassignmentCount > previousReassignmentCount) notify(row.id, row.order_number ?? "Order", "rider_reassigned");
        else if (prev && prev !== row.status) notify(row.id, row.order_number ?? "Order", row.status);
      }
    };
    const channel = supabase
      .channel(`customer-bell-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${userId}` }, payload => {
        const row = payload.new as { id?: string; order_number?: string; status?: string; rider_reassignment_count?: number };
        if (!row?.id || !row.status) return;
        const prev = known.current[row.id];
        const reassignmentCount = Number(row.rider_reassignment_count ?? 0);
        const previousReassignmentCount = knownReassignments.current[row.id];
        known.current[row.id] = row.status;
        knownReassignments.current[row.id] = reassignmentCount;
        if (previousReassignmentCount !== undefined && reassignmentCount > previousReassignmentCount) notify(row.id, row.order_number ?? "Order", "rider_reassigned");
        else if (prev !== row.status) notify(row.id, row.order_number ?? "Order", row.status);
      })
      .subscribe(status => { const ok = status === "SUBSCRIBED"; liveRef.current = ok; setLive(ok); if (ok) void sync(); });
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void sync(); }, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(channel); };
  }, [userId, notify]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const unread = notes.filter(note => !note.read).length;
  const markAllRead = () => setNotes(current => current.map(note => ({ ...note, read: true })));

  return <div ref={wrapRef} className="relative flex items-center gap-2">
    <button type="button" onClick={() => setOpen(value => !value)} aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative grid h-10 w-10 place-items-center rounded-full border border-orange-100 bg-white text-[#102e57] transition hover:border-orange-300 hover:text-orange-600 active:scale-95">
      <Bell size={18} aria-hidden="true" className={ring ? "origin-top animate-bounce text-orange-600" : ""} />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{unread > 9 ? "9+" : unread}</span>}
      <span aria-hidden="true" className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border border-white ${live ? "bg-emerald-500" : "bg-slate-300"}`} />
    </button>
    {open && <div role="dialog" aria-label="Order notifications and alert settings" className="animate-fade-in fixed inset-x-4 top-[4.25rem] z-50 max-h-[min(80vh,42rem)] overflow-y-auto rounded-2xl border border-orange-100 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
      <div className="mb-4 border-b border-slate-100 pb-4">
        <AlertControlBar sound={sound} label="customer alerts" testMessage="Your order has an update." />
      </div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-black text-[#102e57]">Notifications</h2>
        {unread > 0 && <button type="button" onClick={markAllRead} className="text-xs font-bold text-orange-600">Mark all read</button>}
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">{live ? "Live — updates appear instantly." : "Reconnecting… we'll catch up automatically."}</p>
      <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {notes.length ? notes.map(note => <li key={note.id} className={`rounded-xl p-3 text-sm ${note.read ? "bg-slate-50 text-slate-600" : "bg-orange-50 text-[#102e57]"}`}>
          <p className="font-semibold">{note.message}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{note.orderNumber} · {new Date(note.at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</p>
        </li>) : <li className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No updates yet. Order progress will show up here.</li>}
      </ul>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] text-slate-500">Sound preference is saved on this device.</p>
        <Link href={ordersHref} onClick={() => setOpen(false)} className="mt-3 block text-center text-xs font-bold text-orange-600">View my orders →</Link>
      </div>
    </div>}
  </div>;
}
