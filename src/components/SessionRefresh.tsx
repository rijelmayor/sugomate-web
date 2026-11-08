"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresh the current server-rendered route when a suspended tab becomes
 * active again. This lets Supabase middleware rotate an expiring auth
 * session before the user submits a transaction from a stale page.
 */
export default function SessionRefresh() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < 60_000) return;
      lastRefresh.current = now;
      router.refresh();
    };

    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [router]);

  return null;
}
