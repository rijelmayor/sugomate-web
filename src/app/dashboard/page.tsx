import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import CustomerMarketplace from "@/components/customer/CustomerMarketplace";
import { applyAsDriver, applyAsMerchant, signOut } from "./actions";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; partner?: string; category?: string; municipality?: string }> }) {
  const { error, success, partner, category, municipality } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }, { data: merchants }, { data: driver }, { count: orderCount }, { data: categories }, { data: municipalities }, { data: addresses }] = await Promise.all([
    supabase.from("profiles").select("display_name,phone,status").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("merchant_members").select("merchant_id,member_role,merchants(name,status)").eq("user_id", user.id),
    supabase.from("driver_profiles").select("status,vehicle_type").eq("user_id", user.id).maybeSingle(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", user.id),
    supabase.from("product_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order"),
    supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
    supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,municipalities(name)").eq("customer_id", user.id).order("created_at", { ascending: false }),
  ]);
  let productQuery = supabase.from("products").select("id,name,description,price,image_url,merchant:merchants!products_merchant_id_fkey(name,slug),branch:merchant_branches!products_branch_id_fkey(name,municipality_id,municipalities(name)),category:product_categories!products_category_id_fkey(slug)").eq("is_available", true).order("created_at", { ascending: false }).limit(60);
  if (category) productQuery = productQuery.eq("category.slug", category);
  if (municipality) productQuery = productQuery.eq("branch.municipality_id", municipality);
  const { data: productRows, error: productError } = await productQuery;
  const products = productError ? [] : (productRows ?? []).map(row => ({ ...row, price: Number(row.price), merchant: Array.isArray(row.merchant) ? row.merchant[0] : row.merchant, branch: Array.isArray(row.branch) ? row.branch[0] : row.branch }));
  const roleNames = (roles ?? []).map(row => row.role).join(", ") || "customer";
  const hasMerchant = (merchants ?? []).length > 0;
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

        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/15 pt-5 sm:max-w-md"><div><p className="text-2xl font-black">{orderCount ?? 0}</p><p className="mt-1 text-xs text-white/65">Orders placed</p></div><div><p className="text-sm font-bold capitalize">{profile?.status || "Active"}</p><p className="mt-1 text-xs text-white/65">Account status · {roleNames}</p></div></div>
      </section>

      <section id="marketplace" className="mt-7 scroll-mt-6"><div className="mb-4"><p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">Shop your community</p><h2 className="mt-1 text-2xl font-black">Browse products and order directly</h2></div><CustomerMarketplace products={products as never} categories={categories ?? []} selectedCategory={category ?? ""} selectedMunicipality={municipality ?? ""} municipalities={municipalities ?? []} addresses={(addresses ?? []) as never} checkoutError={error}/></section>

      {(error || success) && <p role="status" className={`mt-4 rounded-xl p-4 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{error ? "We could not submit that application. Check your details or contact support." : success === "merchant-pending" ? "Merchant application submitted for review." : "Driver application submitted for review."}</p>}

      <section className="mt-7 grid gap-4 md:grid-cols-3">
        
        <Link href="/customer/orders" className="group rounded-2xl border border-orange-100 bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-100/70"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-2xl">📦</span><h2 className="mt-4 font-black">Your orders</h2><p className="mt-1 text-sm leading-5 text-slate-500">Keep an eye on purchases and delivery updates.</p><p className="mt-4 text-sm font-extrabold text-orange-600">View order history →</p></Link>
        <Link href="/customer/addresses" className="group rounded-2xl border border-orange-100 bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-100/70"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-2xl">📍</span><h2 className="mt-4 font-black">Delivery addresses</h2><p className="mt-1 text-sm leading-5 text-slate-500">Save your home, work, and favorite drop-off points.</p><p className="mt-4 text-sm font-extrabold text-orange-600">Manage addresses →</p></Link>
      </section>

      <section id="merchant-application" className="mt-8 rounded-3xl border border-orange-100 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-orange-600">Grow with us</p><h2 className="mt-1 text-xl font-black">Be part of the SUGOMATE community</h2><p className="mt-1 text-sm text-slate-500">Run a local store or deliver orders around your area.</p></div><Link href="/rider/apply" className="rounded-full bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 transition hover:bg-orange-100">Become a rider →</Link></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <details open={partner === "merchant"} className="group rounded-2xl border border-orange-100 bg-[#fffaf5] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-xl">🏪</span><span><strong className="block text-sm">Merchant partner</strong><span className="text-xs text-slate-500">{hasMerchant ? "Application already on file" : "List your store on SUGOMATE"}</span></span></span><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg transition group-open:rotate-45">＋</span></summary>
            {hasMerchant ? <div className="mt-4 space-y-3">{(merchants ?? []).map((m) => {
              const store = m.merchants as unknown as { name: string; status: string } | null;
              if (!store) return null;
              const status = store.status?.toLowerCase() || "pending";
              const statusStyle = status === "approved" ? "bg-green-50 text-green-700" : status === "rejected" ? "bg-red-50 text-red-700" : status === "suspended" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800";
              const statusLabel = status === "approved" ? "Approved" : status === "rejected" ? "Not approved" : status === "suspended" ? "Suspended" : "Pending review";
              return <div key={m.merchant_id} className="rounded-xl bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-700">Your store: {store.name}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle}`}>{statusLabel}</span></div>
                {status === "approved" ? <Link href="/merchant" className="mt-3 inline-flex rounded-full bg-[#102e57] px-4 py-2 text-sm font-bold text-white">Open Merchant Portal →</Link> : status === "rejected" ? <p className="mt-2 text-sm text-slate-600">Your application was not approved. Please contact SUGOMATE Operations for the review details.</p> : status === "suspended" ? <p className="mt-2 text-sm text-slate-600">Your merchant access is currently suspended. Please contact SUGOMATE Operations.</p> : <p className="mt-2 text-sm text-slate-600">Your application has been received and is waiting for review by SUGOMATE Operations.</p>}
              </div>;
            })}</div> : <form action={applyAsMerchant} className="mt-4 space-y-3"><input required name="business_name" placeholder="Business / store name" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/><input required name="business_slug" placeholder="Store URL name (e.g. juans-store)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/><button className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Submit merchant application</button></form>}
          </details>
          <details id="rider-application" open={partner === "driver"} className="group rounded-2xl border border-orange-100 bg-[#fffaf5] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-xl">🛵</span><span><strong className="block text-sm">Delivery partner</strong><span className="text-xs text-slate-500">{driver ? `Application status: ${driver.status}` : "Earn by delivering in your area"}</span></span></span><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg transition group-open:rotate-45">＋</span></summary>
            {driver ? <p className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-600">Your delivery partner application is <strong className="capitalize">{driver.status}</strong>.</p> : <form action={applyAsDriver} className="mt-4 space-y-3"><select required name="vehicle_type" defaultValue="" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Choose vehicle type</option><option>Motorcycle</option><option>Bicycle</option><option>Car</option><option>Other</option></select><input name="vehicle_plate" placeholder="Plate number (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/><button className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Submit driver application</button></form>}
          </details>
        </div>
      </section>
      <footer className="mt-8 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, among ihatod.</footer>
    </div>
  </main>;
}
