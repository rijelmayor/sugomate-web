"use client";

import { useState } from "react";

type Rider = { id:string; name:string; vehicle:string; locality:string; phone:string };

export default function RiderDirectoryButton({riders}:{riders:Rider[]}) {
 const [open,setOpen]=useState(false);
 return <>
  <button type="button" onClick={()=>setOpen(true)} className="rounded-full border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10">View rider list ↗</button>
  {open&&<div role="dialog" aria-modal="true" aria-labelledby="rider-directory-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6">
   <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#101820] shadow-2xl">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
     <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Dispatch directory</p><h2 id="rider-directory-title" className="mt-1 text-xl font-black text-white">Available unassigned riders</h2><p className="mt-1 text-xs text-slate-400">{riders.length} online and eligible riders · live snapshot when opened</p></div>
     <button type="button" onClick={()=>setOpen(false)} aria-label="Close rider directory" className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">✕ Exit</button>
    </header>
    <div className="min-h-0 flex-1 overflow-auto p-4">
     <table className="w-full min-w-[680px] border-collapse text-left text-sm">
      <thead className="sticky top-0 bg-[#080d13] text-[10px] font-black uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Rider name</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Current locality</th><th className="px-4 py-3">Contact number</th></tr></thead>
      <tbody>{riders.map((r,i)=><tr key={r.id} className="border-t border-white/10 odd:bg-white/[.02]"><td className="px-4 py-3 text-slate-500">{i+1}</td><td className="px-4 py-3 font-bold text-white">{r.name}</td><td className="px-4 py-3 text-slate-300">{r.vehicle}</td><td className="px-4 py-3 text-slate-300">{r.locality}</td><td className="px-4 py-3 text-slate-200">{r.phone}</td></tr>)}</tbody>
     </table>
     {!riders.length&&<p className="p-8 text-center text-sm text-slate-400">No unassigned riders are currently online.</p>}
    </div>
    <footer className="flex justify-end border-t border-white/10 px-5 py-3"><button type="button" onClick={()=>setOpen(false)} className="rounded-xl bg-[#102b4e] px-5 py-2.5 text-sm font-bold text-white">Close directory</button></footer>
   </section>
  </div>}
 </>;
}
