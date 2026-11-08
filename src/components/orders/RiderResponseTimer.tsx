"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RiderResponseTimer({ deadline, compact = false }: {
  deadline: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [expirationProcessed, setExpirationProcessed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!deadline || now < new Date(deadline).getTime() || expirationProcessed) return;
    setExpirationProcessed(true);
    void fetch("/api/rider-response-expire", { method: "POST" })
      .then(() => router.refresh(), () => router.refresh());
  }, [deadline, now, expirationProcessed, router]);

  if (!deadline) return null;
  const remaining = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const expired = remaining <= 0;
  const urgent = remaining <= 120;
  return (
    <span
      role="timer"
      aria-live="off"
      aria-label={expired ? "Rider response time expired" : `Rider response time remaining: ${minutes} minutes ${seconds} seconds`}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black tabular-nums ${expired ? "bg-rose-100 text-rose-800" : urgent ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"} ${compact ? "px-2 py-1 text-[11px]" : ""}`}
    >
      <span className={`h-2 w-2 rounded-full ${expired ? "bg-rose-600" : urgent ? "bg-amber-500" : "bg-emerald-500"}`} />
      {expired ? "Response expired" : `Respond in ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
    </span>
  );
}
