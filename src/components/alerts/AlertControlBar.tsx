"use client";

import { BellRing } from "lucide-react";
import SoundToggle from "@/components/alerts/SoundToggle";
import type { AlertSound } from "@/components/alerts/useAlertSound";

export default function AlertControlBar({ sound, label, testMessage }: {
  sound: AlertSound;
  label: string;
  testMessage: string;
}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
    <div className="flex min-w-0 items-center gap-2.5">
      <BellRing size={18} className="shrink-0 text-[#102e57]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-[#102e57]">Order alerts</p>
        <p className="text-[11px] font-medium text-slate-500">{sound.enabled ? "Sound and voice active" : sound.needsTap ? "Ready — tap once to activate sound" : "Sound paused"}</p>
      </div>
    </div>
    <SoundToggle sound={sound} label={label} testMessage={testMessage} compact />
  </div>;
}