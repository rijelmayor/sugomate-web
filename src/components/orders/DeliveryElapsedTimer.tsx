"use client";

import { useEffect, useState } from "react";

function formatElapsed(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

export default function DeliveryElapsedTimer({ pickedUpAt, deliveredAt, compact = false }: {
  pickedUpAt: string;
  deliveredAt?: string | null;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deliveredAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deliveredAt]);

  const start = new Date(pickedUpAt).getTime();
  const end = deliveredAt ? new Date(deliveredAt).getTime() : now;
  const elapsed = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / 1000)) : 0;
  return <span className={compact ? "font-mono font-bold tabular-nums" : "font-mono text-xl font-black tabular-nums"}>
    {formatElapsed(elapsed)}
  </span>;
}
