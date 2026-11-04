import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }, { count: orderCount }] = await Promise.all([
    supabase.from("profiles").select("display_name,phone,status").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", user.id),
  ]);
  const roleNames = (roles ?? []).map(row => row.role).join(", ") || "customer";
  const firstName = profile?.display_name?.trim().split(/\s+/)[0] || "there";

  return <main className="min-h-screen bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-black tracking-wide text-[#102e57]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-lg text-white">S</span>SUGOMATE</Link>
        <div className="flex items-center gap-2">{(roles ?? []).some(row => row.role === "admin") && <Link href="/admin" className="rounded-full bg-[#102e57] px-4 py-2 text-sm font-bold !text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#174777] hover:shadow-md" style={{ color: "#ffffff" }}>Admin control</Link>}<Link href="/customer/orders" className="hidden rounded-full border border-orange-100 bg-white px-4 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md sm:inline-flex">My orders</Link><form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md" /></form></div>
      </header>

      <section className="relative mt-7 overflow-hidden rounded-[2rem] bg-[#102e57] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-9">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[34px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-[#ff7a00]/20 blur-2xl" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#ffbd18]">Your SUGOMATE space</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Maayong adlaw, {firstName}!</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Your community is just a few taps away. Find what you need, order from local stores, and let us bring it to you.</p></div>
          <Link href="/customer" className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-[#ffbd18] px-6 py-3.5 text-sm font-black text-[#102e57] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#ffd15b]">Explore marketplace <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/15 pt-5 sm:max-w-md"><div><p className="text-2xl font-black">{orderCount ?? 0}</p><p className="mt-1 text-xs text-white/65">Orders placed</p></div><div><p className="text-sm font-bold capitalize">{profile?.status || "Active"}</p><p className="mt-1 text-xs text-white/65">Account status · {roleNames}</p></div></div>
      </section>

      <footer className="mt-8 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, among ihatod.</footer>
    </div>
  </main>;
}
