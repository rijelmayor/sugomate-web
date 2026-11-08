"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ChevronLeft, ChevronRight, MapPin, Minus, Plus, Search, ShoppingBasket, Store, X } from "lucide-react";
import { placeOrder } from "@/app/customer/actions";
import PendingLink from "@/components/PendingLink";
import { CART_KEY } from "@/lib/cart";
import CategoryTile from "@/components/customer/CategoryTile";

type Product = {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  category: { id: string; name: string; slug: string; icon: string } | null;
  merchant: { name: string; slug: string; logo_url?: string | null; accepted_payment_methods?: string[]; gcash_qr_url?: string | null; gcash_payment_type?: string; gcash_account_name?: string | null; gcash_mobile_number?: string | null; store_category?: { id: string; name: string; slug: string; icon: string } | null } | null;
  branch: { name: string; municipalities: { name: string } | null } | null;
};
type Store = { id: string; name: string; branchName: string; categorySlugs: string[]; area: string; count: number; image: string | null; isOpen: boolean; acceptedPaymentMethods: string[]; gcashQrUrl: string | null; gcashPaymentType: string; gcashAccountName: string | null; gcashMobileNumber: string | null };
type Cart = Record<string, { product: Product; quantity: number }>;
type Address = { id: string; label: string; recipient_name: string; recipient_phone: string; address_line: string; municipality_id?: string; municipalities: { name: string } | null };

const peso = (value: number) => `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CheckoutSubmitButton({ disabled, paymentMethod }: { disabled: boolean; paymentMethod: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} aria-busy={pending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff8a00] px-4 py-3.5 text-sm font-extrabold text-white shadow-md shadow-orange-200 transition duration-200 hover:bg-[#ed5a19] active:scale-[.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:active:scale-100 data-[pending=true]:cursor-wait" data-pending={pending}>
    {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
    {pending ? "Placing your order…" : paymentMethod === "gcash" ? "Place GCash order" : "Place COD order"}
  </button>;
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");
  return <div className={`relative aspect-square w-[40%] max-w-44 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-white to-amber-50 ${state === "loading" ? "skeleton" : ""}`}>
    {state !== "ok" && <div aria-hidden="true" className="absolute inset-0 grid place-items-center text-orange-300"><ShoppingBasket size={34} strokeWidth={1.5} /></div>}
    {src && state !== "error" && <img src={src} alt={alt} loading="lazy" decoding="async" onLoad={() => setState("ok")} onError={() => setState("error")} className={`absolute inset-0 h-full w-full object-contain p-2 transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`} />}
  </div>;
}

function StoreCard({ item, href }: { item: Store; href: string }) {
  const content = <><span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-white to-amber-50 text-orange-300">
    {item.image ? <img src={item.image} alt={item.name + " logo"} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" /> : <Store aria-hidden="true" size={30} strokeWidth={1.5} />}
  </span><span className="min-w-0 flex-1"><span className="block truncate text-base font-extrabold text-[#102e57]">{item.name}</span>
    {item.branchName && item.branchName !== item.name && <span className="block truncate text-xs text-slate-500">{item.branchName}</span>}
    <span className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin aria-hidden="true" size={12} className="shrink-0" /><span className="truncate">{item.area || "Leyte"}</span></span>
    <span className={"mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold " + (item.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{item.isOpen ? "Open now" : "Closed"}</span>
  </span>{item.isOpen ? <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-slate-300" /> : <span className="text-[11px] font-bold text-slate-400">Unavailable</span>}</>;
  const className = "flex min-w-0 items-center gap-3 rounded-3xl border border-orange-100/90 bg-white p-3 shadow-[0_5px_18px_rgba(16,46,87,0.07)] transition duration-200 " + (item.isOpen ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-75");
  return item.isOpen ? <PendingLink href={href} className={className}>{content}</PendingLink> : <div aria-disabled="true" className={className}>{content}</div>;
}

export default function CustomerMarketplace({ products, stores, selectedStore = "", selectedMunicipality, municipalities, merchantCategories = [], selectedMerchantCategory = "", addresses, checkoutError, deliveryFees = {}, merchantUsageEnabled = false, merchantUsageMethod = "percentage", merchantUsageValue = 0 }: {
  products: Product[];
  stores: Store[];
  selectedStore?: string;
  selectedMunicipality: string;
  municipalities: { id: string; name: string }[];
  merchantCategories?: { id: string; name: string; slug: string; icon: string; parent_id?: string | null; image_url?: string | null }[];
  selectedMerchantCategory?: string;
  addresses: Address[];
  checkoutError?: string;
  deliveryFees?: Record<string, number>;
  merchantUsageEnabled?: boolean;
  merchantUsageMethod?: "percentage" | "fixed" | string;
  merchantUsageValue?: number;
}) {
  const router = useRouter();
  const [isFiltering, startFilter] = useTransition();
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "__new__");
  const [newMunicipalityId, setNewMunicipalityId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  // Recheck server-calculated store hours periodically so a storefront closes without a manual reload.
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 60000); return () => window.clearInterval(timer); }, [router]);

  // Restore the basket after a refresh, a failed checkout, or leaving and returning.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Cart;
        const next: Cart = {};
        for (const [id, entry] of Object.entries(parsed ?? {})) {
          if (entry?.product?.id === id && Number.isInteger(entry.quantity) && entry.quantity > 0 && entry.quantity < 100) next[id] = entry;
        }
        setCart(next);
      }
    } catch { /* storage unavailable: basket just works for this visit */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
  }, [cart, hydrated]);
  // Refresh saved items with the latest name and price from the server.
  useEffect(() => {
    if (!hydrated) return;
    setCart(current => {
      let changed = false;
      const next = { ...current };
      for (const p of products) {
        const entry = next[p.id];
        if (entry && (Number(entry.product.price) !== Number(p.price) || entry.product.name !== p.name)) { next[p.id] = { ...entry, product: p }; changed = true; }
      }
      return changed ? next : current;
    });
  }, [products, hydrated]);
  // Lock page scroll while the mobile basket sheet is open; Esc closes it.
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSheetOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [sheetOpen]);

  // A search typed on the home or store list should not silently filter the next store's menu.
  useEffect(() => { setSearch(""); }, [selectedStore]);

  const items = Object.values(cart);
  const usagePerUnit = (srp: number) => !merchantUsageEnabled ? 0 : merchantUsageMethod === "fixed" ? merchantUsageValue : Math.round((srp * merchantUsageValue / 100) * 100) / 100;
  const displayUnitPrice = (product: Product) => Number(product.price) + usagePerUnit(Number(product.price));
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + displayUnitPrice(item.product) * item.quantity, 0);
  const q = search.trim().toLowerCase();
  const currentStore = stores.find(item => item.id === selectedStore);
  const productMatches = useMemo(() => products.filter(p => (!selectedMerchantCategory || p.category?.slug === selectedMerchantCategory) && (!q || p.name.toLowerCase().includes(q))), [products, q, selectedMerchantCategory]);
  const tiles = merchantCategories;
  const topLevelTiles = tiles;
  const selectedCategory = tiles.find(item => item.slug === selectedMerchantCategory);
  const activeCategory = selectedCategory;
  const storeMatches = stores.filter(item => (!selectedMerchantCategory || item.categorySlugs.includes(selectedMerchantCategory)) && (!q || item.name.toLowerCase().includes(q) || item.area.toLowerCase().includes(q)));
  const view: "store" | "stores" | "home" = currentStore ? "store" : q || selectedMerchantCategory ? "stores" : "home";
  const firstItem = items[0]?.product;
  const sameStore = items.every(({ product }) => product.branch_id === firstItem?.branch_id);
  const cartStore = stores.find(item => item.id === firstItem?.branch_id);
  const storeClosed = Boolean(cartStore) && !cartStore?.isOpen;
  // The basket store can sit outside the current area filter; the server re-verifies hours and stock on checkout.
  const canCheckout = items.length > 0 && sameStore && Boolean(addressId) && !storeClosed;
  const selectedAddress = addresses.find(a => a.id === addressId);
  const feeMunicipality = addressId === "__new__" ? newMunicipalityId : selectedAddress?.municipality_id ?? "";
  const fee = feeMunicipality ? deliveryFees[feeMunicipality] : undefined;
  const acceptedPaymentMethods = cartStore?.acceptedPaymentMethods ?? firstItem?.merchant?.accepted_payment_methods ?? ["cod"];
  const gcashQrUrl = cartStore?.gcashQrUrl ?? firstItem?.merchant?.gcash_qr_url ?? null;
  const gcashPaymentType = cartStore?.gcashPaymentType ?? firstItem?.merchant?.gcash_payment_type ?? "qr";
  const gcashAccountName = cartStore?.gcashAccountName ?? firstItem?.merchant?.gcash_account_name ?? null;
  const gcashMobileNumber = cartStore?.gcashMobileNumber ?? firstItem?.merchant?.gcash_mobile_number ?? null;
  const gcashConfigured = gcashPaymentType === "number" ? Boolean(gcashAccountName && gcashMobileNumber) : Boolean(gcashQrUrl);

  function href(next: { storeCategory?: string; store?: string; municipality?: string }) {
    const params = new URLSearchParams();
    const storeCategory = next.storeCategory ?? selectedMerchantCategory;
    const store = next.store ?? "";
    const municipality = next.municipality ?? selectedMunicipality;
    if (storeCategory) params.set("storeCategory", storeCategory);
    if (store) params.set("store", store);
    if (municipality) params.set("municipality", municipality);
    const query = params.toString();
    return query ? `/customer?${query}` : "/customer";
  }
  function add(product: Product) {
    setCart(current => ({ ...current, [product.id]: { product, quantity: (current[product.id]?.quantity ?? 0) + 1 } }));
  }
  function clearBasket() { setCart({}); }
  function change(id: string, delta: number) {
    setCart(current => {
      const next = { ...current };
      const quantity = (next[id]?.quantity ?? 0) + delta;
      if (quantity <= 0) delete next[id];
      else if (quantity < 100) next[id] = { ...next[id], quantity };
      return next;
    });
  }

  return <div className={`grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] ${count > 0 ? "pb-24 lg:pb-0" : ""}`}>
    {checkoutError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 lg:col-span-2">{checkoutError === "checkout" ? "We could not place your order. Check store availability, product stock, and delivery coverage. Your basket is still saved." : checkoutError === "address" ? "Please complete your delivery address before placing the order." : "Your basket could not be processed. Please review your items and try again."}</p>}
    <section className="w-full min-w-0">
      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={view === "store" ? "Search this store's items…" : "Search stores or areas…"} aria-label="Search" className="box-border h-12 w-full min-w-0 rounded-2xl border border-orange-100 bg-white pl-10 pr-10 text-sm text-[#102e57] shadow-sm outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-200" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 active:scale-90"><X size={16} /></button>}
        </div>
        {view !== "store" && <div className="relative">
          <MapPin aria-hidden="true" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500" />
          <select value={selectedMunicipality} onChange={e => startFilter(() => router.push(href({ municipality: e.target.value })))} aria-label="Filter by service area" className="box-border h-12 w-full min-w-0 rounded-2xl border border-orange-100 bg-white pl-9 pr-3 text-sm text-[#102e57] shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200">
            <option value="">All service areas</option>
            {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>}
      </div>

      <div className={`transition-opacity duration-200 ${isFiltering ? "pointer-events-none opacity-50" : ""}`}>
      {view === "home" && <>
        <div className="mt-6"><h2 className="text-xl font-black text-[#102e57]">Browse by category</h2><p className="mt-0.5 text-sm text-slate-500">Pick what you need — we&apos;ll show the stores.</p></div>
        {topLevelTiles.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {topLevelTiles.map(item => <CategoryTile key={item.id} href={href({ storeCategory: item.slug })} name={item.name} slug={item.slug} imageUrl={item.image_url} count={item.count} />)}
        </div> : null}
        <div className="mt-8"><h2 className="text-xl font-black text-[#102e57]">Stores near you</h2></div>
        {stores.length > 0 && <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{stores.slice(0, 6).map(item => <StoreCard key={item.id} item={item} href={href({ store: item.id })} />)}</div>}
        {!stores.length && <div className="mt-6 rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center sm:p-12"><ShoppingBasket aria-hidden="true" size={44} strokeWidth={1.5} className="mx-auto text-orange-300" /><h3 className="mt-4 text-xl font-black text-[#102e57]">Your local marketplace is getting ready</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">We&apos;re preparing merchant catalogs in Hilongos, Bato, Hindang, Inopacan, and Matalom. Approved stores will appear here as they join.</p></div>}
      </>}

      {view === "stores" && <>
        <div className="mt-5 flex items-center gap-3">
          <PendingLink href={href({ storeCategory: "" })} aria-label="Back to categories" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-[#102e57] shadow-sm"><ChevronLeft size={20} /></PendingLink>
          <div className="min-w-0"><h2 className="truncate text-xl font-black text-[#102e57]">{q ? "Search results" : activeCategory?.name ?? "Stores"}</h2><p className="text-xs text-slate-400">{isFiltering ? "Updating…" : `${storeMatches.length} ${storeMatches.length === 1 ? "store" : "stores"}`}</p></div>
        </div>
        {storeMatches.length ? <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{storeMatches.map(item => <StoreCard key={item.id} item={item} href={href({ store: item.id })} />)}</div> : <div className="mt-4 rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center sm:p-12"><Store aria-hidden="true" size={44} strokeWidth={1.5} className="mx-auto text-orange-300" /><h3 className="mt-4 text-xl font-black text-[#102e57]">{q ? "No matching stores" : "No stores here yet"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{q ? "Try another store or area name." : "Stores in this category will appear here once they are approved."}</p></div>}
      </>}

      {view === "store" && currentStore && <>
        <div className="mt-5 flex items-center gap-2">
          <PendingLink href={href({ store: "" })} aria-label="Back to stores" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-[#102e57]"><ChevronLeft size={18} /></PendingLink>
          <div className="min-w-0"><h2 className="truncate text-xl font-black text-[#102e57]">{currentStore.name}</h2><p className="flex items-center gap-1 text-xs text-slate-400"><MapPin aria-hidden="true" size={12} />{currentStore.branchName && currentStore.branchName !== currentStore.name ? `${currentStore.branchName} · ` : ""}{currentStore.area || "Leyte"} · {productMatches.length} {productMatches.length === 1 ? "item" : "items"}</p></div>
        </div>
        {productMatches.length ? <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {productMatches.map(product => { const qty = cart[product.id]?.quantity ?? 0; return <article key={product.id} className="flex min-w-0 overflow-hidden rounded-3xl border border-orange-100/90 bg-white p-2 shadow-[0_5px_18px_rgba(16,46,87,0.07)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <ProductImage src={product.image_url} alt={product.name} />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 break-words text-sm font-extrabold leading-snug text-[#102e57] sm:text-base">{product.name}</h3>
              <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-600 sm:text-xs"><Store aria-hidden="true" size={13} className="shrink-0" /><span className="line-clamp-1">{product.merchant?.name || "Local store"}</span></p>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-400 sm:text-xs"><MapPin aria-hidden="true" size={13} className="shrink-0" /><span className="line-clamp-1">{product.branch?.municipalities?.name || "Leyte"}</span></p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div><strong className="text-base font-black text-[#e95718] sm:text-lg">{peso(displayUnitPrice(product))}</strong>{usagePerUnit(Number(product.price))>0&&<p className="text-[9px] font-semibold text-slate-400">Includes System Usage {peso(usagePerUnit(Number(product.price)))}</p>}</div>
              {qty > 0 ? <div className="inline-flex items-center rounded-full bg-[#102e57] text-white shadow-sm">
                <button type="button" onClick={() => change(product.id, -1)} aria-label={`Remove one ${product.name}`} className="grid h-9 w-9 place-items-center rounded-full transition active:scale-90"><Minus size={16} /></button>
                <span key={qty} aria-live="polite" className="animate-pop min-w-6 text-center text-sm font-black">{qty}</span>
                <button type="button" onClick={() => change(product.id, 1)} aria-label={`Add one ${product.name}`} className="grid h-9 w-9 place-items-center rounded-full transition active:scale-90"><Plus size={16} /></button>
              </div> : <button type="button" onClick={() => add(product)} aria-label={`Add ${product.name} to basket`} className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-[#102e57] px-4 text-xs font-extrabold text-white shadow-sm transition duration-200 hover:bg-[#174777] hover:shadow-md active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"><Plus size={14} /> Add</button>}
            </div>
          </div>
        </article>; })}
        </div> : <div className="mt-4 rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center sm:p-12"><ShoppingBasket aria-hidden="true" size={44} strokeWidth={1.5} className="mx-auto text-orange-300" /><h3 className="mt-4 text-xl font-black text-[#102e57]">{!currentStore.isOpen ? "This store is currently closed" : q ? "No matching items" : "No items available right now"}</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{!currentStore.isOpen ? "Ordering is disabled outside the store’s operating hours. Please check back when the store reopens." : q ? "Try another item name." : "Please check back soon."}</p></div>}
      </>}
      </div>
    </section>

    {sheetOpen && <div onClick={() => setSheetOpen(false)} aria-hidden="true" className="animate-fade-in fixed inset-0 z-40 bg-slate-900/50 lg:hidden" />}
    {count > 0 && !sheetOpen && <div className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4 pt-2 lg:hidden">
      <button type="button" onClick={() => setSheetOpen(true)} className="flex w-full items-center justify-between rounded-full bg-[#ff8a00] px-5 py-3.5 text-white shadow-xl shadow-orange-300/60 transition active:scale-[.98]">
        <span className="flex items-center gap-2 text-sm font-extrabold"><span key={count} className="animate-bump grid h-7 min-w-7 place-items-center rounded-full bg-white px-1.5 text-xs font-black text-[#ed5a19]">{count}</span>View basket</span>
        <span className="text-sm font-black">{peso(total)}</span>
      </button>
    </div>}

    <aside role={sheetOpen ? "dialog" : undefined} aria-modal={sheetOpen ? true : undefined} aria-label="Your basket" className={`min-w-0 border border-orange-100 bg-white p-5 shadow-sm transition-[transform,visibility] duration-300 ease-out fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl shadow-2xl pb-safe ${sheetOpen ? "visible translate-y-0" : "invisible translate-y-full"} lg:visible lg:inset-x-auto lg:bottom-auto lg:z-auto lg:h-fit lg:max-h-none lg:translate-y-0 lg:overflow-visible lg:rounded-3xl lg:pb-5 lg:shadow-sm lg:sticky lg:top-5`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-[#102e57]">Your basket</h2>
        <div className="flex items-center gap-2">{count > 0 && <button type="button" onClick={clearBasket} className="rounded-full px-2.5 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-rose-600 active:scale-95">Clear</button>}<span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">{count} {count === 1 ? "item" : "items"}</span><button type="button" onClick={() => setSheetOpen(false)} aria-label="Close basket" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 transition active:scale-90 lg:hidden"><X size={18} /></button></div>
      </div>
      {items.length ? <div className="mt-4 space-y-4">
        {items.map(({ product, quantity }) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0"><p className="truncate text-sm font-bold text-[#102e57]">{product.name}</p><p className="text-xs text-slate-500">{peso(displayUnitPrice(product))} / unit{usagePerUnit(Number(product.price))>0?` · includes ${peso(usagePerUnit(Number(product.price)))} System Usage`:""}</p></div>
          <div className="flex items-center gap-1"><button type="button" onClick={() => change(product.id, -1)} aria-label={`Remove one ${product.name}`} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 transition active:scale-90"><Minus size={15} /></button><span key={quantity} className="animate-pop w-6 text-center text-sm font-bold">{quantity}</span><button type="button" onClick={() => change(product.id, 1)} aria-label={`Add one ${product.name}`} className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-orange-700 transition active:scale-90"><Plus size={15} /></button></div>
        </div>)}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600"><span>Items subtotal</span><span>{peso(total)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Delivery fee</span><span>{fee !== undefined ? peso(fee) : "Calculated at checkout"}</span></div>
          {fee !== undefined && <div className="flex justify-between border-t border-slate-100 pt-2 font-black text-[#102e57]"><span>Total before promotions</span><span>{peso(total + fee)}</span></div>}
        </div>
        {items.length > 0 && storeClosed && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">This store is closed. You can keep your basket, but checkout will be available when it reopens.</p>}
        {!sameStore && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Please place separate orders for each store or branch. Remove items from other stores to continue. <button type="button" onClick={clearBasket} className="font-extrabold underline">Start a fresh basket</button></p>}
        <form action={placeOrder} className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="font-extrabold text-[#102e57]">Delivery details</h3>
          <label htmlFor="checkout-address" className="block text-xs font-bold text-slate-600">Delivery address <span className="text-rose-600">· required</span></label>
          <select id="checkout-address" name="address_id" required value={addressId} onChange={e => setAddressId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-[#102e57]">
            {addresses.map(a => <option key={a.id} value={a.id}>{a.label} · {a.address_line} ({a.municipalities?.name ?? "Area"})</option>)}
            <option value="__new__">＋ Enter a new delivery address</option>
          </select>
          {addressId === "__new__" && <div className="space-y-2 rounded-xl border border-orange-100 bg-orange-50/60 p-3">
            <p className="text-xs font-extrabold text-[#102e57]">Where should we deliver?</p>
            <input name="new_label" defaultValue="Home" placeholder="Address label (Home, Work)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]" />
            <input name="recipient_name" required placeholder="Recipient full name" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]" />
            <input name="recipient_phone" required type="tel" placeholder="Mobile number" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]" />
            <select name="municipality_id" required value={newMunicipalityId} onChange={e => setNewMunicipalityId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]"><option value="" disabled>Select municipality</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <textarea name="address_line" required minLength={5} rows={2} placeholder="House no., street, purok / sitio, barangay" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]" />
            <input name="landmark" placeholder="Nearby landmark (optional)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]" />
          </div>}
          <label htmlFor="checkout-note" className="block text-xs font-bold text-slate-600">Delivery note (optional)</label>
          <textarea id="checkout-note" name="customer_note" value={customerNote} onChange={e => setCustomerNote(e.target.value)} maxLength={500} rows={2} placeholder="Landmark, instructions for the rider…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#102e57]" />
          <input type="hidden" name="items" value={JSON.stringify(items.map(({ product, quantity }) => ({ product_id: product.id, quantity })))} />
          <fieldset className="space-y-2"><legend className="text-xs font-bold text-slate-600">Payment method</legend>
            {acceptedPaymentMethods.includes("cod") && <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="radio" name="payment_method_choice" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="accent-orange-500"/>Cash on delivery</label>}
            {acceptedPaymentMethods.includes("gcash") && <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="radio" name="payment_method_choice" value="gcash" checked={paymentMethod === "gcash"} onChange={() => setPaymentMethod("gcash")} className="accent-orange-500"/>GCash</label>}
          </fieldset>
          <input type="hidden" name="payment_method" value={paymentMethod}/>
          {paymentMethod === "gcash" && gcashConfigured && <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-center"><p className="text-xs font-bold text-sky-900">GCash payment details</p>{gcashPaymentType === "qr" && gcashQrUrl ? <img src={gcashQrUrl} alt="Merchant GCash payment QR" className="mx-auto mt-2 h-40 w-40 rounded-xl border border-slate-200 bg-white object-contain p-2"/> : <div className="mt-2 rounded-xl bg-white p-3 text-left"><p className="text-xs text-slate-500">Account name</p><p className="font-extrabold text-[#102e57]">{gcashAccountName}</p><p className="mt-2 text-xs text-slate-500">GCash number</p><p className="text-lg font-black tracking-wide text-[#102e57]">{gcashMobileNumber}</p></div>}<p className="mt-2 text-[11px] leading-5 text-sky-800">Place your order first. Your exact amount, including delivery fee, and the payment upload form will appear in My Orders.</p></div>}
          <div className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900"><strong>Payment: {paymentMethod === "gcash" ? "GCash" : "Cash on delivery"}</strong><br />The store will confirm your order.{fee === undefined && " Delivery fee is calculated by SUGOMATE at checkout."}</div>
          <CheckoutSubmitButton disabled={!canCheckout || !acceptedPaymentMethods.includes(paymentMethod) || (paymentMethod === "gcash" && !gcashConfigured)} paymentMethod={paymentMethod} />
          <p className="text-center text-[11px] leading-4 text-slate-400">Prices, stock, store approval and delivery fees are verified securely when you place the order.</p>
        </form>
        <Link href="/customer/addresses" className="block text-center text-xs font-bold text-slate-500 underline">Manage saved addresses</Link>
      </div> : <div className="py-8 text-center"><ShoppingBasket aria-hidden="true" size={40} strokeWidth={1.5} className="mx-auto text-orange-300" /><p className="mt-3 text-sm font-semibold text-slate-600">Your basket is empty</p><p className="mt-1 text-xs text-slate-400">Add items from local stores to get started.</p></div>}
    </aside>
  </div>;
}
