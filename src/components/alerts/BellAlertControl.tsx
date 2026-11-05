"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import AlertControlBar from "@/components/alerts/AlertControlBar";
import type { AlertSound } from "@/components/alerts/useAlertSound";

export default function BellAlertControl({ sound, label, testMessage }: {
  sound: AlertSound;
  label: string;
  testMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return <div ref={wrapRef} className="relative z-30 flex items-center">
    <button
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={open ? "Close alert settings" : "Open alert settings"}
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-orange-100 bg-white text-[#102e57] shadow-sm transition hover:border-orange-300 hover:text-orange-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <Bell size={19} aria-hidden="true" />
      <span aria-hidden="true" className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${sound.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
    </button>
    {open && <div role="dialog" aria-label="Alert settings" className="animate-fade-in absolute right-0 top-full mt-3 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-orange-100 bg-white p-3 shadow-2xl">
      <AlertControlBar sound={sound} label={label} testMessage={testMessage} />
    </div>}
  </div>;
}
