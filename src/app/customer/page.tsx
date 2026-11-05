import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import PendingLink from "@/components/PendingLink";
import CustomerMarketplace from "@/components/customer/CustomerMarketplace";
import { signOut } from "../dashboard/actions";

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ error?: string; category?: string; municipality?: string; storeCategory?: string }> }) {
  const { error, category, municipality, storeCategory } = await searchParams;
  // Shared with the layout through React cache(): one auth + roles lookup per request.
  const { user, supabase } = await requireCustomer();

  // !inner makes the category / area filters really remove products instead of only blanking the joined column.
  let productQuery = supabase.from("products").select(`id,name,description,price,image_url,merchant:merchants!products_merchant_id_fkey(name,slug,store_category:merchant_categories!merchants_category_id_fkey(id,name,slug,icon)),branch:merchant_branches!products_branch_id_fkey${municipality ? "!inner" : ""}(name,municipality_id,municipalities(name)),category:product_categories!products_category_id_fkey${category ? "!inner" : ""}(slug)`).eq("is_available", true).order("created_at", { ascending: false }).limit(60);
  if (category) productQuery = productQuery.eq("category.slug", category);
  if (municipality) productQuery = productQuery.eq("branch.municipality_id", municipality);

  const [{ data: profile }, { data: categories }, { data: municipalities }, { data: addresses }, { data: merchantCategories }, { data: zones }, { data: productRows, error: productError }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("product_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order"),
    supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
    supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,municipality_id,municipalities(name)").eq("customer_id", user.id).order("created_at", { ascending: false }),
    supabase.from("merchant_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order").order("name"),
    // Optional: needs 20261105110000_customer_read_delivery_fees.sql. Without it this returns nothing and checkout shows "Calculated at checkout".
    supabase.from("service_zones").select("municipality_id,base_delivery_fee").eq("is_active", true).order("created_at", { ascending: true }),
    productQuery,
  ]);
  const products = productError ? [] : (productRows ?? []).map(row => ({ ...row, price: Number(row.price), merchant: Array.isArray(row.merchant) ? row.merchant[0] : row.merchant, branch: Array.isArray(row.branch) ? row.branch[0] : row.branch }));
  const deliveryFees: Record<string, number> = {};
  for (const zone of zones ?? []) if (!(zone.municipality_id in deliveryFees)) deliveryFees[zone.municipality_id] = Number(zone.base_delivery_fee);
  const firstName = profile?.display_name?.trim().split(/\s+/)[0] || "there";

  return <main className="min-h-screen bg-[#fff7ef] px-4 py-5 text-[#102e57] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-black tracking-wide text-[#102e57]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-lg text-white">S</span>SUGOMATE</Link>
        <div className="flex items-center gap-2">
          <PendingLink href="/customer/orders" aria-label="My orders" className="rounded-full border border-orange-100 bg-white px-3.5 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md"><ClipboardList aria-hidden="true" size={16} /><span>Orders</span></PendingLink>
          <form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md" /></form>
        </div>
      </header>

      <section className="mt-6 mb-5">
        <p className="text-sm font-bold text-orange-600">Maayong adlaw, {firstName}!</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Unsa imong sugo karon?</h1>
      </section>

      <section id="marketplace" className="scroll-mt-6"><CustomerMarketplace products={products as never} categories={categories ?? []} selectedCategory={category ?? ""} selectedMunicipality={municipality ?? ""} municipalities={municipalities ?? []} merchantCategories={merchantCategories ?? []} selectedMerchantCategory={storeCategory ?? ""} addresses={(addresses ?? []) as never} checkoutError={error} deliveryFees={deliveryFees} /></section>

      <footer className="mt-8 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, among ihatod.</footer>
    </div>
  </main>;
}
