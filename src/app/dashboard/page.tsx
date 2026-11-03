import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyAsDriver, applyAsMerchant, signOut } from "./actions";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }, { data: merchants }, { data: driver }] = await Promise.all([
    supabase.from("profiles").select("display_name,phone,status").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("merchant_members").select("merchant_id,member_role,merchants(name,status)").eq("user_id", user.id),
    supabase.from("driver_profiles").select("status,vehicle_type").eq("user_id", user.id).maybeSingle(),
  ]);
  const roleNames = (roles ?? []).map(row => row.role).join(", ") || "customer";
  const hasMerchant = (merchants ?? []).length > 0;
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-10 text-[#102e57]">
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center justify-between gap-4"><Link href="/" className="text-sm font-black text-orange-600">SUGOMATE</Link><form action={signOut}><button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Sign out</button></form></header>
      <section className="mt-8 rounded-3xl bg-white p-7 shadow-lg shadow-orange-100/60 sm:p-9">
        <p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">Your account</p>
        <h1 className="mt-2 text-3xl font-black">Maayong pag-abot, {profile?.display_name || user.email}!</h1>
        <p className="mt-2 text-sm text-slate-500">{user.email} · {roleNames}</p>
        <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">Your SUGOMATE account is active. Customer ordering and delivery features will be enabled as the marketplace is built.</p>
      </section>
      {(error || success) && <p role="status" className={`mt-4 rounded-xl p-4 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{error ? "We could not submit that application. Check your details or contact support." : success === "merchant-pending" ? "Merchant application submitted for review." : "Driver application submitted for review."}</p>}
      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-orange-100 bg-white p-6">
          <h2 className="text-lg font-black">Become a merchant</h2>
          {hasMerchant ? <p className="mt-3 text-sm text-slate-500">Your store application is on file: {(merchants ?? []).map(m => (m.merchants as unknown as {name:string;status:string} | null)?.name).filter(Boolean).join(", ")}.</p> : <><p className="mt-2 text-sm leading-6 text-slate-500">Register your local business. Our operations team will review your store before it goes live.</p><form action={applyAsMerchant} className="mt-4 space-y-3"><input required name="business_name" placeholder="Business / store name" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/><input required name="business_slug" placeholder="Store URL name (e.g. juans-store)" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/><button className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Apply as merchant</button></form></>}
        </article>
        <article className="rounded-2xl border border-orange-100 bg-white p-6">
          <h2 className="text-lg font-black">Become a delivery partner</h2>
          {driver ? <p className="mt-3 text-sm text-slate-500">Driver application status: <strong className="capitalize">{driver.status}</strong>.</p> : <><p className="mt-2 text-sm leading-6 text-slate-500">Apply to deliver orders in your service area. Approval is required before accepting deliveries.</p><form action={applyAsDriver} className="mt-4 space-y-3"><select required name="vehicle_type" defaultValue="" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Choose vehicle type</option><option>Motorcycle</option><option>Bicycle</option><option>Car</option><option>Other</option></select><input name="vehicle_plate" placeholder="Plate number (optional)" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/><button className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Apply as delivery partner</button></form></>}
        </article>
      </section>
    </div>
  </main>;
}
