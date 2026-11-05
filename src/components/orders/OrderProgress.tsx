import { Bike } from "lucide-react";

// Shared by the customer orders page and the merchant order cards (no hooks, so it works in server components).
const steps = [
  { label: "Placed", statuses: ["pending_merchant"] },
  { label: "Accepted", statuses: ["accepted"] },
  { label: "Preparing", statuses: ["preparing", "ready_for_pickup"] },
  { label: "On the way", statuses: ["assigned", "picked_up", "in_transit"] },
  { label: "Delivered", statuses: ["delivered"] },
];
const riderStatuses = new Set(["assigned", "picked_up", "in_transit"]);
const captions: Record<string, string> = {
  ready_for_pickup: "Waiting for a rider",
  assigned: "Rider is heading to the store",
  picked_up: "Rider picked up the order",
  in_transit: "Rider is on the way",
};

export default function OrderProgress({ status }: { status: string }) {
  const current = steps.findIndex(step => step.statuses.includes(status));
  if (current < 0) return null;
  const delivered = status === "delivered";
  const riderActive = riderStatuses.has(status);
  return <div>
    <ol aria-label="Order progress" className="mt-4 flex items-start">{steps.map((step, index) => {
      const done = index < current || delivered;
      const active = index === current && !delivered;
      const lineDone = index <= current || delivered;
      const lineMoving = !delivered && index === current + 1;
      // The motorcycle only rides once a real rider holds the order, on the final stretch to the customer.
      const showRider = riderActive && index === 4;
      return <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
        {index > 0 && <span aria-hidden="true" className="absolute right-1/2 top-[9px] h-0.5 w-full">
          <span className={`absolute inset-0 rounded-full ${lineDone ? "bg-orange-400" : "bg-slate-200"}`} />
          {lineMoving && <span className="track-flow absolute inset-0 rounded-full" />}
          {showRider && <span className="rider-go absolute -top-[7px] text-orange-600"><Bike size={16} strokeWidth={2.5} /></span>}
        </span>}
        <span className={`relative z-10 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${done ? "bg-orange-500 text-white" : active ? "bg-orange-500 text-white ring-4 ring-orange-200 animate-pulse" : "bg-slate-200 text-slate-400"}`}>{done ? "✓" : index + 1}</span>
        <span className={`mt-1.5 text-[10px] leading-3 sm:text-[11px] ${done || active ? "font-bold text-[#102e57]" : "text-slate-400"}`}>{step.label}</span>
      </li>;
    })}</ol>
    {captions[status] && <p aria-live="polite" className="mt-3 text-center text-xs font-semibold text-orange-700">{captions[status]}</p>}
  </div>;
}
