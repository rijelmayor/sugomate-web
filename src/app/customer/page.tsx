import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import CustomerMarketplace from "@/components/customer/CustomerMarketplace";
import { signOut } from "../dashboard/actions";

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ error?: string; category?: string; municipality?: string; storeCategory?: string }> }) {
  const { error, category, municipality, storeCategory } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roleSet = new Set((roles ?? []).map(row => row.role));
  if (roleSet.has("admin")) redirect("/admin");
  if (roleSet.has("driver")) redirect("/driver");
  if (roleSet.has("merchant")) redirect("/merchant");
  if (!roleSet.has("customer")) redirect("/login?error=role");

  const [{ data: profile }, { count: orderCount }, { data: categories }, { data: municipalities }, { data: addresses }, { data: merchantCategories }] = await Promise.all([
    supabase.from("profiles").select("display_name,phone,status").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", user.id),
    supabase.from("product_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order"),
    supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
    supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,municipalities(name)").eq("customer_id", user.id).order("created_at", { ascending: false }),
    supabase.from("merchant_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order").order("name"),
  ]);
  let productQuery = supabase.from("products").select("id,name,description,price,image_url,merchant:merchants!products_merchant_id_fkey(name,slug,store_category:merchant_categories!merchants_category_id_fkey(id,name,slug,icon)),branch:merchant_branches!products_branch_id_fkey(name,municipality_id,municipalities(name)),category:product_categories!products_category_id_fkey(slug)").eq("is_available", true).order("created_at", { ascending: false }).limit(60);
  if (category) productQuery = productQuery.eq("category.slug", category);
  if (municipality) productQuery = productQuery.eq("branch.municipality_id", municipality);
  const { data: productRows, error: productError } = await productQuery;
  const products = productError ? [] : (productRows ?? []).map(row => ({ ...row, price: Number(row.price), merchant: Array.isArray(row.merchant) ? row.merchant[0] : row.merchant, branch: Array.isArray(row.branch) ? row.branch[0] : row.branch }));
  const roleNames = "customer";
  const firstName = profile?.display_name?.trim().split(/\s+/)[0] || "there";

  return <main className="min-h-screen bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-black tracking-wide text-[#102e57]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-lg text-white">S</span>SUGOMATE</Link>
        <div className="flex items-center gap-2"><Link href="/customer/orders" className="hidden rounded-full border border-orange-100 bg-white px-4 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md sm:inline-flex">My orders</Link><form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md" /></form></div>
      </header>

      <section className="relative mt-7 overflow-hidden rounded-[2rem] bg-[#102e57] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-9">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[34px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-[#ff7a00]/20 blur-2xl" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#ffbd18]">Your SUGOMATE space</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Maayong adlaw, {firstName}!</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Your community is just a few taps away. Find what you need, order from local stores, and let us bring it to you.</p></div>

        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/15 pt-5 sm:max-w-md"><div><p className="text-2xl font-black">{orderCount ?? 0}</p><p className="mt-1 text-xs text-white/65">Orders placed</p></div><div><p className="text-sm font-bold capitalize">{profile?.status || "Active"}</p><p className="mt-1 text-xs text-white/65">Account status · {roleNames}</p></div></div>
      </section>

      <section id="marketplace" className="mt-7 scroll-mt-6"><div className="mb-4"><p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">Shop your community</p><h2 className="mt-1 text-2xl font-black">Browse products and order directly</h2></div><CustomerMarketplace products={products as never} categories={categories ?? []} selectedCategory={category ?? ""} selectedMunicipality={municipality ?? ""} municipalities={municipalities ?? []} merchantCategories={merchantCategories ?? []} selectedMerchantCategory={storeCategory ?? ""} addresses={(addresses ?? []) as never} checkoutError={error}/></section>

      <footer className="mt-8 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, among ihatod.</footer>
    </div>
  </main>;
}
