import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import PendingLink from "@/components/PendingLink";
import NotificationBell from "@/components/notifications/NotificationBell";
import CustomerMarketplace from "@/components/customer/CustomerMarketplace";
import { signOut } from "../dashboard/actions";

// The select string is chosen at run time (full or legacy), so the row shape is declared here instead of inferred.
type Cat = { id: string; name: string; slug: string; icon: string };
type MerchantRel = { name: string; slug: string; logo_url: string | null; accepted_payment_methods?: string[]; gcash_qr_url?: string | null; gcash_payment_type?: string; gcash_account_name?: string | null; gcash_mobile_number?: string | null; store_category: Cat | Cat[] | null };
type BranchRel = { name: string; municipality_id: string; store_hours?: unknown; is_temporarily_closed?: boolean; municipalities: { name: string } | { name: string }[] | null };
type ProductRow = { id: string; name: string; description: string | null; price: number | string; image_url: string | null; branch_id: string; category: Cat | Cat[] | null; merchant: MerchantRel | MerchantRel[] | null; branch: BranchRel | BranchRel[] | null };

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ error?: string; municipality?: string; storeCategory?: string; store?: string }> }) {
  const { error, municipality, storeCategory, store } = await searchParams;
  // Shared with the layout through React cache(): one auth + roles lookup per request.
  const { user, supabase } = await requireCustomer();

  // One lightweight pass over available products; stores and category counts are derived from it.
  // Needs 20261105150000_merchant_storefront_hours_payments.sql. Without it the full query errors, so we retry with the older columns instead of showing no stores.
  const productSelect = (legacy: boolean) => legacy ? `id,name,description,price,image_url,branch_id,category:product_categories!products_category_id_fkey(id,name,slug,icon),merchant:merchants!products_merchant_id_fkey(name,slug,logo_url,store_category:merchant_categories!merchants_category_id_fkey(id,name,slug,icon)),branch:merchant_branches!products_branch_id_fkey${municipality ? "!inner" : ""}(name,municipality_id,municipalities(name))` : `id,name,description,price,image_url,branch_id,category:product_categories!products_category_id_fkey(id,name,slug,icon),merchant:merchants!products_merchant_id_fkey(name,slug,logo_url,accepted_payment_methods,gcash_qr_url,gcash_payment_type,gcash_account_name,gcash_mobile_number,store_category:merchant_categories!merchants_category_id_fkey(id,name,slug,icon)),branch:merchant_branches!products_branch_id_fkey${municipality ? "!inner" : ""}(name,municipality_id,store_hours,is_temporarily_closed,municipalities(name))`;
  const buildProductQuery = (legacy: boolean) => {
    let query = supabase.from("products").select(productSelect(legacy)).eq("is_available", true).order("created_at", { ascending: false }).limit(400);
    if (municipality) query = query.eq("branch.municipality_id", municipality);
    return query;
  };
  const productQuery = buildProductQuery(false);

  const [{ data: profile }, { data: municipalities }, { data: serviceZones }, { data: addresses }, { data: categoryRows, error: categoryError }, { data: zones }, { data: firstProductRows, error: firstProductError }, { data: financialSettings }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
    supabase.from("service_zones").select("id,name,municipality_id,base_delivery_fee").eq("is_active",true).order("name"),
    supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,municipality_id,service_zone_id,service_zones(name),municipalities(name)").eq("customer_id", user.id).order("created_at", { ascending: false }),
    supabase.from("product_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order").order("name"),
    // Optional: needs 20261105110000_customer_read_delivery_fees.sql. Without it this returns nothing and checkout shows "Calculated at checkout".
    supabase.from("service_zones").select("municipality_id,barangay_id,base_delivery_fee").eq("is_active", true).order("created_at", { ascending: true }),
    productQuery,
    supabase.from("platform_financial_settings").select("merchant_usage_enabled,merchant_usage_method,merchant_usage_value").eq("id",1).maybeSingle(),
  ]);
  let productRows: unknown = firstProductRows;
  let productError = firstProductError;
  if (firstProductError) {
    console.error("[customer] product query failed, retrying without storefront columns:", firstProductError.message);
    const retry = await buildProductQuery(true);
    productRows = retry.data; productError = retry.error;
    if (retry.error) console.error("[customer] legacy product query failed:", retry.error.message);
  }
  const productCategories = categoryRows ?? [];
  // Supabase types nested joins as arrays; take the first element so one-to-one relations read naturally.
  const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);
  const rows = productError ? [] : ((productRows ?? []) as ProductRow[]).map(row => {
    const merchant = one(row.merchant);
    const branch = one(row.branch);
    return {
      ...row,
      price: Number(row.price),
      category: one(row.category),
      merchant: merchant ? { ...merchant, store_category: one(merchant.store_category) } : null,
      branch: branch ? { ...branch, municipalities: one(branch.municipalities) } : null,
    };
  });

  // A "store" is one merchant branch, matching the one-store-per-order rule at checkout.
  const storeMap = new Map<string, { id: string; name: string; branchName: string; categorySlugs: string[]; area: string; count: number; image: string | null; isOpen: boolean; acceptedPaymentMethods: string[]; gcashQrUrl: string | null; gcashPaymentType: string; gcashAccountName: string | null; gcashMobileNumber: string | null }>();
  for (const row of rows) {
    const existing = storeMap.get(row.branch_id);
    if (existing) { if (row.category?.slug && !existing.categorySlugs.includes(row.category.slug)) existing.categorySlugs.push(row.category.slug); existing.count += 1; continue; }
    const schedule = (row.branch?.store_hours ?? {}) as Record<string, {open?:string;close?:string;closed?:boolean}>;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
    const dayKey = part("weekday").toLowerCase().slice(0,3);
    const slot = schedule[dayKey] ?? { open: "08:00", close: "20:00", closed: false };
    const nowMinutes = Number(part("hour")) * 60 + Number(part("minute"));
    const openMinutes = Number((slot.open ?? "08:00").slice(0,2)) * 60 + Number((slot.open ?? "08:00").slice(3,5));
    const closeMinutes = Number((slot.close ?? "20:00").slice(0,2)) * 60 + Number((slot.close ?? "20:00").slice(3,5));
    const isOpen = !row.branch?.is_temporarily_closed && !slot.closed && nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    storeMap.set(row.branch_id, { id: row.branch_id, name: row.merchant?.name ?? "Local store", branchName: row.branch?.name ?? "", categorySlugs: row.category?.slug ? [row.category.slug] : [], area: row.branch?.municipalities?.name ?? "", count: 1, image: row.merchant?.logo_url ?? null, isOpen, acceptedPaymentMethods: row.merchant?.accepted_payment_methods ?? ["cod"], gcashQrUrl: row.merchant?.gcash_qr_url ?? null, gcashPaymentType: row.merchant?.gcash_payment_type ?? "qr", gcashAccountName: row.merchant?.gcash_account_name ?? null, gcashMobileNumber: row.merchant?.gcash_mobile_number ?? null });
  }
  const stores = [...storeMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  // Only the open store's menu is sent to the browser, which keeps the home page light.
  const products = store && storeMap.get(store)?.isOpen ? rows.filter(row => row.branch_id === store && (!storeCategory || row.category?.slug === storeCategory)) : [];

  const zoneFees: Record<string, number> = {};
  for (const zone of zones ?? []) if (zone.id) zoneFees[zone.barangay_id] = Number(zone.base_delivery_fee);
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
      <NotificationBell userId={user.id} />

      <section className="mt-6 mb-5">
        <p className="text-sm font-bold text-orange-600">Maayong adlaw, {firstName}!</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Unsa imong sugo karon?</h1>
      </section>

      <section id="marketplace" className="scroll-mt-6"><CustomerMarketplace serviceZones={serviceZones ?? []} products={products as never} stores={stores} selectedStore={store ?? ""} selectedMunicipality={municipality ?? ""} municipalities={municipalities ?? []} merchantCategories={productCategories} selectedMerchantCategory={storeCategory ?? ""} addresses={(addresses ?? []) as never} checkoutError={error} zoneFees={zoneFees} merchantUsageEnabled={financialSettings?.merchant_usage_enabled??false} merchantUsageMethod={financialSettings?.merchant_usage_method??"percentage"} merchantUsageValue={Number(financialSettings?.merchant_usage_value??0)} /></section>

      <footer className="mt-8 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, kami bahala.</footer>
    </div>
  </main>;
}
