export default function PageSkeleton({ variant = "list" }: { variant?: "market" | "list" }) {
  return <main aria-busy="true" aria-label="Loading" className="min-h-screen bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between"><div className="skeleton h-9 w-36 rounded-xl" /><div className="skeleton h-9 w-24 rounded-full" /></div>
      <div className="skeleton mt-6 h-8 w-64 rounded-lg" />
      <div className="skeleton mt-4 h-12 rounded-xl" />
      {variant === "market" ? <>
        <div className="mt-4 flex gap-2 overflow-hidden">{[0,1,2,3,4].map(i => <div key={i} className="skeleton h-10 w-24 shrink-0 rounded-full" />)}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{[0,1,2,3,4,5].map(i => <div key={i} className="skeleton h-32 rounded-3xl" />)}</div>
      </> : <div className="mt-5 space-y-3">{[0,1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-transparent" />Loading…</div>
    </div>
  </main>;
}
