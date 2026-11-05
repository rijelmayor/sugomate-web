"use client";

import { Bell, BellOff } from "lucide-react";
import type { AlertSound } from "./useAlertSound";

export default function SoundToggle({ sound, label = "sound alerts", testMessage = "Sound alerts are on.", className = "" }: {
  sound: AlertSound;
  label?: string;
  testMessage?: string;
  className?: string;
}) {
  if (sound.unsupported) return <p role="alert" className={`rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ${className}`}>This browser could not enable audio. Check the device volume or try Chrome or Safari.</p>;
  if (!sound.enabled) return <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    <button type="button" onClick={() => void sound.enable()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#102e57] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#174777] active:scale-[.97]"><Bell size={16} aria-hidden="true" />Enable {label}</button>
    {sound.needsTap && <span className="text-xs font-semibold text-amber-700">Tap anywhere to turn sound on.</span>}
  </div>;
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" />Sound on</span>
    <button type="button" onClick={() => { sound.chime(); window.setTimeout(() => sound.speak(testMessage), 600); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition active:scale-[.97]">Test</button>
    <button type="button" onClick={sound.disable} aria-label={`Turn off ${label}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition active:scale-[.97]"><BellOff size={14} aria-hidden="true" />Off</button>
  </div>;
}
