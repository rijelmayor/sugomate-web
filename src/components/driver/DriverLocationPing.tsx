"use client";

import { useEffect, useState } from "react";

// Pings the driver's browser location while they are online.
// Used to sort nearby orders and for future nearest-rider matching.
export default function DriverLocationPing({ isOnline }: { isOnline: boolean }) {
  const [status, setStatus] = useState<"idle" | "ok" | "denied" | "error">("idle");

  useEffect(() => {
    if (!isOnline || typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    async function ping(lat: number, lng: number) {
      try {
        const res = await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
        if (!cancelled) setStatus(res.ok ? "ok" : "error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    function locate() {
      navigator.geolocation.getCurrentPosition(
        pos => ping(pos.coords.latitude, pos.coords.longitude),
        () => { if (!cancelled) setStatus("denied"); },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
      );
    }

    locate();
    const id = window.setInterval(locate, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [isOnline]);

  if (!isOnline) return null;
  const label = status === "ok" ? "Location shared" : status === "denied" ? "Location off" : status === "error" ? "Location error" : "Sharing location…";
  return <span className="text-xs text-white/60">{label}</span>;
}
