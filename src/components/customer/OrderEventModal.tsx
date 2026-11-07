"use client";

import { useEffect, useMemo, useState } from "react";
import { Bike, CheckCircle2, MapPin, Phone, Store, X } from "lucide-react";

type Driver = {
  name: string;
  phone: string | null;
  vehicleType: string | null;
  plate: string | null;
  photoUrl: string | null;
};
type EventItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  kind: "accepted" | "driver";
  createdAt: string;
  merchantName: string;
  recipientName: string;
  address: string;
  total: number;
  driver?: Driver | null;
};

export default function OrderEventModal({ events }: { events: EventItem[] }) {
  const [active, setActive] = useState<EventItem | null>(null);
  const [queue, setQueue] = useState<EventItem[]>([]);
  const recentEvents = useMemo(() => events.filter(event => {
    const age = Date.now() - new Date(event.createdAt).getTime();
    return Number.isFinite(age) && age >= -60_000 && age <= 15 * 60_000;
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [events]);

  useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(window.localStorage.getItem("sugomate-seen-order-events") || "[]");
      if (!Array.isArray(seen)) seen = [];
    } catch { seen = []; }
    const fresh = recentEvents.filter(event => !seen.includes(event.id));
    if (!fresh.length) return;
    const nextSeen = [...seen, ...fresh.map(event => event.id)].slice(-200);
    try { window.localStorage.setItem("sugomate-seen-order-events", JSON.stringify(nextSeen)); } catch { /* storage can be disabled */ }
    setQueue(current => {
      const known = new Set([...current.map(event => event.id), ...(active ? [active.id] : [])]);
      return [...current, ...fresh.filter(event => !known.has(event.id))];
    });
  }, [recentEvents, active]);

  useEffect(() => {
    if (!active && queue.length) {
      setActive(queue[0]);
      setQueue(current => current.slice(1));
    }
  }, [active, queue]);

  if (!active) return null;
  const isDriver = active.kind === "driver";
  const close = () => setActive(null);

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102e57]/55 p-4 backdrop-blur-sm" role="presentation" onClick={close}>
    <section role="dialog" aria-modal="true" aria-labelledby="order-event-title" className="w-full max-w-md overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-2xl animate-fade-in" onClick={event => event.stopPropagation()}>
      <div className="relative bg-gradient-to-br from-[#fff4e8] to-white px-6 pb-5 pt-7 text-center">
        <button type="button" onClick={close} aria-label="Close notification" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-500 shadow-sm"><X size={18}/></button>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#ff8a00] text-white shadow-lg shadow-orange-200">
          {isDriver ? <Bike size={28}/> : <Store size={27}/>}
        </div>
        <h2 id="order-event-title" className="mt-4 text-xl font-black tracking-tight text-[#102e57]">{isDriver ? "Delivery partner found!" : "Your order is accepted!"}</h2>
        <p className="mt-1 text-sm text-slate-500">{isDriver ? "A delivery partner has claimed your order." : "The store has confirmed your order and reserved your items."}</p>
      </div>

      <div className="space-y-4 px-6 py-5">
        <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Order details</span>
            <span className="text-xs font-bold text-[#102e57]">{active.orderNumber}</span>
          </div>
          <p className="mt-2 font-extrabold text-[#102e57]">{active.merchantName}</p>
          <p className="mt-1 text-xs text-slate-600">{active.recipientName}</p>
          <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-600"><MapPin size={15} className="mt-0.5 shrink-0 text-orange-600"/><span>{active.address || "Delivery address on your order"}</span></div>
          <div className="mt-3 flex items-center justify-between border-t border-orange-200 pt-3 text-sm"><span className="font-semibold text-slate-600">Order total</span><strong className="text-base text-[#102e57]">₱{Number(active.total).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
        </div>

        {isDriver && <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-emerald-800">Your delivery partner</p>
          <div className="flex items-center gap-3">
            {active.driver?.photoUrl ? <img src={active.driver.photoUrl} alt="Delivery partner" className="h-16 w-16 rounded-2xl border-2 border-white object-cover shadow-sm"/> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-emerald-700"><Bike size={28}/></div>}
            <div className="min-w-0 flex-1">
              <p className="font-black text-[#102e57]">{active.driver?.name || "Delivery partner"}</p>
              <p className="mt-1 text-xs text-slate-600">{active.driver?.vehicleType || "Motorcycle"}{active.driver?.plate ? " · " + active.driver.plate : ""}</p>
              {active.driver?.phone && <a href={`tel:${active.driver.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800"><Phone size={13}/>{active.driver.phone}</a>}
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800"><CheckCircle2 size={14}/> Registered delivery partner assigned</p>
        </div>}

        <button type="button" onClick={close} className="min-h-12 w-full rounded-full bg-[#102e57] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#174777]">OK, Got it</button>
      </div>
    </section>
  </div>;
}
