"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-route-error]", error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#fff7ef] px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-orange-100 bg-white p-7 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">SUGOMATE</p>
        <h1 className="mt-3 text-2xl font-black text-[#102e57]">This page needs to reload</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">The page may have been open during an update or your connection may have been interrupted. Your account and saved orders are not changed by this recovery.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={() => reset()} className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Try again</button>
          <button onClick={() => window.location.reload()} className="rounded-full border border-orange-200 px-5 py-3 text-sm font-bold text-[#102e57]">Reload latest version</button>
        </div>
        {error.digest && <p className="mt-4 text-[11px] text-slate-400">Reference: {error.digest}</p>}
      </section>
    </main>
  );
}
