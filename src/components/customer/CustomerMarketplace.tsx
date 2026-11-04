"use client";

import Link from "next/link";
import { placeOrder } from "@/app/customer/actions";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  merchant: { name: string; slug: string; store_category?: { id: string; name: string; slug: string; icon: string } | null } | null;
  branch: { name: string; municipalities: { name: string } | null } | null;
};

function FilterSubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex h-12 min-w-[4.5rem] items-center justify-center gap-2 rounded-xl bg-[#ffbd18] px-4 text-sm font-black text-[#102e57] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#ffd04a] hover:shadow-md active:translate-y-0 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102e57] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70">
    {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#102e57]/30 border-t-[#102e57]" />}
    {pending ? "Applying…" : "Go"}
  </button>;
}

function CheckoutSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff8a00] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#ed5a19] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
    {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
    {pending ? "Placing your order…" : "Place COD order"}
  </button>;
}

export default function CustomerMarketplace({ products, categories, selectedCategory, selectedMunicipality, municipalities, merchantCategories = [], selectedMerchantCategory = "", addresses, checkoutError }: {
  products: Product[];
  categories: { id: string; name: string; slug: string; icon: string }[];
  selectedCategory: string;
  selectedMunicipality: string;
  municipalities: { id: string; name: string }[];
  merchantCategories?: { id: string; name: string; slug: string; icon: string }[];
  selectedMerchantCategory?: string;
  addresses: { id: string; label: string; recipient_name: string; recipient_phone: string; address_line: string; municipalities: { name: string } | null }[];
  checkoutError?: string;
}) {
  const [cart, setCart] = useState<Record<string, { product: Product; quantity: number }>>({});
  const [search, setSearch] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "__new__");
  const items = Object.values(cart);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const visible = useMemo(() => products.filter(p => (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.merchant?.name.toLowerCase().includes(search.toLowerCase())) && (!selectedMerchantCategory || p.merchant?.store_category?.slug === selectedMerchantCategory)), [products, search, selectedMerchantCategory]);
  const firstItem = items[0]?.product;
  const sameStore = items.every(({ product }) => product.merchant?.slug === firstItem?.merchant?.slug && product.branch?.name === firstItem?.branch?.name);
  const canCheckout = items.length > 0 && sameStore && Boolean(addressId);

  function add(product: Product) {
    setCart(current => ({ ...current, [product.id]: { product, quantity: (current[product.id]?.quantity ?? 0) + 1 } }));
  }
  function change(id: string, delta: number) {
    setCart(current => {
      const next = { ...current };
      const quantity = (next[id]?.quantity ?? 0) + delta;
      if (quantity <= 0) delete next[id];
      else next[id] = { ...next[id], quantity };
      return next;
    });
  }

  return <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    {checkoutError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 lg:col-span-2">{checkoutError === "checkout" ? "We could not place your order. Check store availability, product stock, and delivery coverage." : checkoutError === "address" ? "Please complete your delivery address before placing the order." : "Your basket could not be processed. Please review your items and try again."}</p>}
    <section className="w-full min-w-0">
      <div className="box-border w-full max-w-full min-w-0 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#102e57] via-[#124d80] to-[#ed5a19] p-5 text-white shadow-lg sm:p-7 lg:p-8">
        <p className="text-xs font-black uppercase tracking-[.18em] text-orange-200">SUGOMATE marketplace</p>
        <h1 className="mt-2 max-w-full break-words text-[clamp(1.8rem,5vw,2.5rem)] font-black leading-tight">Unsa imong sugo?</h1>
        <p className="mt-2 max-w-prose break-words text-sm leading-6 text-white/85 sm:text-base">Discover local stores and everyday essentials from your community.</p>
        <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search food, stores, groceries…" aria-label="Search food, stores, and groceries" className="box-border h-12 w-full min-w-0 rounded-xl border border-white/30 bg-white px-4 text-sm text-[#102e57] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300"/>
          <form action="/customer" className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select name="municipality" defaultValue={selectedMunicipality} aria-label="Filter by service area" className="box-border h-12 w-full min-w-0 rounded-xl border border-white/30 bg-white px-3 text-sm text-[#102e57]">
              <option value="">All service areas</option>
              {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <FilterSubmitButton />
          </form>
        </div>
      </div>

      {merchantCategories.length > 0 && <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Shop by store type</p><div aria-label="Store categories" className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin]"><a href={`/customer${selectedMunicipality ? `?municipality=${selectedMunicipality}` : ""}`} className={`inline-flex min-h-9 shrink-0 items-center rounded-full px-4 py-2 text-xs font-bold ${!selectedMerchantCategory ? "bg-[#102e57] text-white" : "border border-slate-200 bg-white text-[#102e57]"}`}>All stores</a>{merchantCategories.map(item => <a key={item.id} href={`/customer?storeCategory=${item.slug}${selectedMunicipality ? `&municipality=${selectedMunicipality}` : ""}`} className={`inline-flex min-h-9 shrink-0 items-center rounded-full px-4 py-2 text-xs font-bold ${selectedMerchantCategory === item.slug ? "bg-[#102e57] text-white" : "border border-slate-200 bg-white text-[#102e57]"}`}>{item.icon} {item.name}</a>)}</div></div>}

      <div aria-label="Product categories" className="mt-5 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin]">
        <a href="/customer" aria-current={!selectedCategory ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${!selectedCategory ? "bg-[#102e57] text-white shadow-sm" : "border border-slate-200 bg-white text-[#102e57]"}`} style={!selectedCategory ? { color: "#ffffff", WebkitTextFillColor: "#ffffff" } : undefined}>All</a>
        {categories.map(category => { const isSelected = selectedCategory === category.slug; return <a key={category.id} href={`/customer?category=${category.slug}${selectedMunicipality ? `&municipality=${selectedMunicipality}` : ""}`} aria-current={isSelected ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-4 py-2.5 text-sm font-bold transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${isSelected ? "bg-[#102e57] !text-white shadow-sm" : "border border-slate-200 bg-white text-[#102e57]"}`} style={isSelected ? { color: "#ffffff", WebkitTextFillColor: "#ffffff" } : undefined}>{category.icon} <span style={isSelected ? { color: "#ffffff", WebkitTextFillColor: "#ffffff" } : undefined}>{category.name}</span></a>; })}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div><h2 className="text-xl font-black text-[#102e57]">Popular near you</h2><p className="mt-1 text-sm text-slate-500">Local merchants approved by SUGOMATE</p></div>
        <span className="text-xs font-semibold text-slate-400">{visible.length} items</span>
      </div>

      {visible.length ? <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(product => <article key={product.id} className="min-w-0 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <div role="img" aria-label={product.name} className="flex h-36 items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 text-5xl" style={product.image_url ? { backgroundImage: `linear-gradient(#ffffff20,#ffffff20),url("${product.image_url}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!product.image_url && "🍽️"}</div>
          <div className="p-4">
            <h3 className="font-extrabold text-[#102e57]">{product.name}</h3>
            <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{product.description || product.merchant?.name || "Local favorite"}</p>
            <p className="mt-2 text-xs text-slate-400">{product.merchant?.name || "Local store"} · {product.branch?.municipalities?.name || "Leyte"}</p>
            <div className="mt-3 flex items-center justify-between gap-2"><strong className="text-lg text-[#e95718]">₱{Number(product.price).toFixed(2)}</strong><button type="button" onClick={() => add(product)} className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#102e57] px-4 py-2 text-xs font-extrabold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#174777] hover:shadow-md active:translate-y-0 active:scale-[.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">+ Add</button></div>
          </div>
        </article>)}
      </div> : <div className="mt-4 rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center sm:p-12">
        <div className="text-5xl">🛍️</div><h3 className="mt-4 text-xl font-black text-[#102e57]">{search ? "No matching items" : "Your local marketplace is getting ready"}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{search ? "Try another product or store name." : "We’re preparing merchant catalogs in Hilongos, Bato, Hindang, Inopacan, and Matalom. Approved stores and products will appear here as they join."}</p>
      </div>}
    </section>

    <aside className="h-fit min-w-0 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm lg:sticky lg:top-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#102e57]">Your basket</h2><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">{count} items</span></div>
      {items.length ? <div className="mt-4 space-y-4">
        {items.map(({product, quantity}) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0"><p className="truncate text-sm font-bold text-[#102e57]">{product.name}</p><p className="text-xs text-slate-500">₱{Number(product.price).toFixed(2)}</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => change(product.id,-1)} aria-label={`Remove one ${product.name}`} className="h-7 w-7 rounded-full border border-slate-200 font-bold">−</button><span className="w-4 text-center text-sm font-bold">{quantity}</span><button type="button" onClick={() => change(product.id,1)} aria-label={`Add one ${product.name}`} className="h-7 w-7 rounded-full bg-orange-100 font-bold text-orange-700">+</button></div>
        </div>)}
        <div className="flex justify-between pt-1 font-black text-[#102e57]"><span>Items subtotal</span><span>₱{total.toFixed(2)}</span></div>
        {!sameStore && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Please place separate orders for each store or branch. Remove items from other stores to continue.</p>}
        <form action={placeOrder} className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="font-extrabold text-[#102e57]">Delivery details</h3>
          <label htmlFor="checkout-address" className="block text-xs font-bold text-slate-600">Delivery address <span className="text-rose-600">· required</span></label>
          <select id="checkout-address" name="address_id" required value={addressId} onChange={e => setAddressId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-[#102e57]">
            {addresses.map(a => <option key={a.id} value={a.id}>{a.label} · {a.address_line} ({a.municipalities?.name ?? "Area"})</option>)}
            <option value="__new__">＋ Enter a new delivery address</option>
          </select>
          {addressId === "__new__" && <div className="space-y-2 rounded-xl border border-orange-100 bg-orange-50/60 p-3">
            <p className="text-xs font-extrabold text-[#102e57]">Where should we deliver?</p>
            <input name="new_label" defaultValue="Home" placeholder="Address label (Home, Work)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]"/>
            <input name="recipient_name" required placeholder="Recipient full name" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]"/>
            <input name="recipient_phone" required type="tel" placeholder="Mobile number" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]"/>
            <select name="municipality_id" required defaultValue="" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]"><option value="" disabled>Select municipality</option>{municipalities.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <textarea name="address_line" required minLength={5} rows={2} placeholder="House no., street, purok / sitio, barangay" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]"/>
            <input name="landmark" placeholder="Nearby landmark (optional)" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#102e57]"/>
          </div>}
          <label htmlFor="checkout-note" className="block text-xs font-bold text-slate-600">Delivery note (optional)</label>
          <textarea id="checkout-note" name="customer_note" value={customerNote} onChange={e => setCustomerNote(e.target.value)} maxLength={500} rows={2} placeholder="Landmark, instructions for the rider…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#102e57]"/>
          <input type="hidden" name="items" value={JSON.stringify(items.map(({product, quantity}) => ({product_id:product.id,quantity})))} />
          <div className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900"><strong>Payment: Cash on delivery</strong><br/>The store will confirm your order. Delivery fee is calculated by SUGOMATE at checkout.</div>
          <CheckoutSubmitButton disabled={!canCheckout}/>
          <p className="text-center text-[11px] leading-4 text-slate-400">Prices, stock, store approval and delivery fees are verified securely when you place the order.</p>
        </form>
        <Link href="/customer/addresses" className="block text-center text-xs font-bold text-slate-500 underline">Manage saved addresses</Link>
      </div> : <div className="py-8 text-center"><div className="text-4xl">🧺</div><p className="mt-3 text-sm font-semibold text-slate-600">Your basket is empty</p><p className="mt-1 text-xs text-slate-400">Add items from local stores to get started.</p></div>}
    </aside>
  </div>;
}
