import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import PendingLink from "@/components/PendingLink";
import NotificationBell from "@/components/notifications/NotificationBell";
import CustomerMarketplace from "@/components/customer/CustomerMarketplace";
import { signOut } from "../dashboard/actions";

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ error?: string; municipality?: string; storeCategory?: string; store?: string }> }) {
  const { error, municipality, storeCategory, store } = await searchParams;
  // Shared with the layout through React cache(): one auth + roles lookup per request.
  const { user, supabase } = await requireCustomer();

  // One lightweight pass over available products; stores and category counts are derived from it.
  let productQuery = supabase.from("products").select(`id,name,description,price,image_url,branch_id,merchant:merchants!products_merchant_id_fkey(name,slug,logo_url,accepted_payment_methods,gcash_qr_url,store_category:merchant_categories!merchants_category_id_fkey(id,name,slug,icon)),branch:merchant_branches!products_branch_id_fkey${municipality ? "!inner" : ""}(name,municipality_id,store_hours,is_temporarily_closed,municipalities(name))`).eq("is_available", true).order("created_at", { ascending: false }).limit(400);
  if (municipality) productQuery = productQuery.eq("branch.municipality_id", municipality);

  const [{ data: profile }, { data: municipalities }, { data: addresses }, { data: merchantCategories }, { data: zones }, { data: productRows, error: productError }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
    supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,municipality_id,municipalities(name)").eq("customer_id", user.id).order("created_at", { ascending: false }),
    supabase.from("merchant_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order").order("name"),
    // Optional: needs 20261105110000_customer_read_delivery_fees.sql. Without it this returns nothing and checkout shows "Calculated at checkout".
    supabase.from("service_zones").select("municipality_id,base_delivery_fee").eq("is_active", true).order("created_at", { ascending: true }),
    productQuery,
  ]);
  // Supabase types nested joins as arrays; take the first element so one-to-one relations read naturally.
  const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);
  const rows = productError ? [] : (productRows ?? []).map(row => {
    const merchant = one(row.merchant);
    const branch = one(row.branch);
    return {
      ...row,
      price: Number(row.price),
      merchant: merchant ? { ...merchant, store_category: one(merchant.store_category) } : null,
      branch: branch ? { ...branch, municipalities: one(branch.municipalities) } : null,
    };
  });

  // A "store" is one merchant branch, matching the one-store-per-order rule at checkout.
  const storeMap = new Map<string, { id: string; name: string; branchName: string; categorySlug: string; area: string; count: number; image: string | null; isOpen: boolean; acceptedPaymentMethods: string[]; gcashQrUrl: string | null }>();
  for (const row of rows) {
    const existing = storeMap.get(row.branch_id);
    if (existing) { existing.count += 1; if (!existing.image && row.image_url) existing.image = row.image_url; continue; }
    const schedule = (row.branch?.store_hours ?? {}) as Record<string, {open?:string;close?:string;closed?:boolean}>;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
    const dayKey = part("weekday").toLowerCase().slice(0,3);
    const slot = schedule[dayKey] ?? { open: "08:00", close: "20:00", closed: false };
    const nowMinutes = Number(part("hour")) * 60 + Number(part("minute"));
    const openMinutes = Number((slot.open ?? "08:00").slice(0,2)) * 60 + Number((slot.open ?? "08:00").slice(3,5));
    const closeMinutes = Number((slot.close ?? "20:00").slice(0,2)) * 60 + Number((slot.close ?? "20:00").slice(3,5));
    const isOpen = !row.branch?.is_temporarily_closed && !slot.closed && nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    storeMap.set(row.branch_id, { id: row.branch_id, name: row.merchant?.name ?? "Local store", branchName: row.branch?.name ?? "", categorySlug: row.merchant?.store_category?.slug ?? "other", area: row.branch?.municipalities?.name ?? "", count: 1, image: row.merchant?.logo_url ?? null, isOpen, acceptedPaymentMethods: row.merchant?.accepted_payment_methods ?? ["cod"], gcashQrUrl: row.merchant?.gcash_qr_url ?? null });
  }
  const stores = [...storeMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  // Only the open store's menu is sent to the browser, which keeps the home page light.
  const products = store && storeMap.get(store)?.isOpen ? rows.filter(row => row.branch_id === store) : [];

  const deliveryFees: Record<string, number> = {};
  for (const zone of zones ?? []) if (!(zone.municipality_id in deliveryFees)) deliveryFees[zone.municipality_id] = Number(zone.base_delivery_fee);
  const firstName = profile?.display_name?.trim().split(/\s+/)[0] || "there";

  return <main className="min-h-screen bg-[#fff7ef] px-4 py-5 text-[#102e57] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-black tracking-wide text-[#102e57]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-lg text-white">S</span>SUGOMATE</Link>
        <div className="flex items-center gap-2">
          <PendingLink href="/customer/orders" aria-label="My orders" className="rounded-full border border-orange-100 bg-white px-3.5 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md"><ClipboardList aria-hidden="true" size={16} /><span>Orders</span></PendingLink>
          <NotificationBell userId={user.id} />
          <form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md" /></form>
        </div>
      </header>

      <section className="mt-6 mb-5">
        <p className="text-sm font-bold text-orange-600">Maayong adlaw, {firstName}!</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Unsa imong sugo karon?</h1>
      </section>

      <section id="marketplace" className="scroll-mt-6"><CustomerMarketplace products={products as never} stores={stores} selectedStore={store ?? ""} selectedMunicipality={municipality ?? ""} municipalities={municipalities ?? []} merchantCategories={merchantCategories ?? []} selectedMerchantCategory={storeCategory ?? ""} addresses={(addresses ?? []) as never} checkoutError={error} deliveryFees={deliveryFees} /></section>

      <footer className="mt-8 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, among ihatod.</footer>
    </div>
  </main>;
}
