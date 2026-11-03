"use client";

import Link from "next/link";
import { placeOrder } from "@/app/customer/actions";
import { useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  merchant: { name: string; slug: string } | null;
  branch: { name: string; municipalities: { name: string } | null } | null;
};

export default function CustomerMarketplace({ products, categories, selectedCategory, selectedMunicipality, municipalities, addresses }: {
  products: Product[];
  categories: { id: string; name: string; slug: string; icon: string }[];
  selectedCategory: string;
  selectedMunicipality: string;
  municipalities: { id: string; name: string }[];
}) {
  const [cart, setCart] = useState<Record<string, { product: Product; quantity: number }>>({});
  const [search, setSearch] = useState("");
  const items = Object.values(cart);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const visible = useMemo(() => products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.merchant?.name.toLowerCase().includes(search.toLowerCase())), [products, search]);

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

  return <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
    <section>
      <div className="rounded-3xl bg-gradient-to-r from-[#102e57] via-[#124d80] to-[#ed5a19] p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.18em] text-orange-200">SUGOMATE marketplace</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Unsa imong sugo?</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">Discover local stores and everyday essentials from your community.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search food, stores, groceries…" className="w-full rounded-xl border border-white/30 bg-white px-4 py-3 text-sm text-[#102e57] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300"/>
          <form action="/customer" className="flex gap-2">
            <select name="municipality" defaultValue={selectedMunicipality} className="min-w-0 flex-1 rounded-xl border border-white/30 bg-white px-3 py-3 text-sm text-[#102e57]">
              <option value="">All service areas</option>
              {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button className="rounded-xl bg-[#ffbd18] px-4 py-3 text-sm font-black text-[#102e57]">Go</button>
          </form>
        </div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        <a href="/customer" className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold ${!selectedCategory ? "bg-[#102e57] text-white" : "border border-slate-200 bg-white text-[#102e57]"}`}>All</a>
        {categories.map(category => <a key={category.id} href={`/customer?category=${category.slug}${selectedMunicipality ? `&municipality=${selectedMunicipality}` : ""}`} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold ${selectedCategory === category.slug ? "bg-[#102e57] text-white" : "border border-slate-200 bg-white text-[#102e57]"}`}>{category.icon} {category.name}</a>)}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div><h2 className="text-xl font-black text-[#102e57]">Popular near you</h2><p className="mt-1 text-sm text-slate-500">Local merchants approved by SUGOMATE</p></div>
        <span className="text-xs font-semibold text-slate-400">{visible.length} items</span>
      </div>

      {visible.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(product => <article key={product.id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <div role="img" aria-label={product.name} className="flex h-36 items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 text-5xl" style={product.image_url ? { backgroundImage: `linear-gradient(#ffffff20,#ffffff20),url("${product.image_url}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!product.image_url && "🍽️"}</div>
          <div className="p-4">
            <h3 className="font-extrabold text-[#102e57]">{product.name}</h3>
            <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{product.description || product.merchant?.name || "Local favorite"}</p>
            <p className="mt-2 text-xs text-slate-400">{product.merchant?.name || "Local store"} · {product.branch?.municipalities?.name || "Leyte"}</p>
            <div className="mt-3 flex items-center justify-between gap-2"><strong className="text-lg text-[#e95718]">₱{Number(product.price).toFixed(2)}</strong><button onClick={() => add(product)} className="rounded-full bg-[#102e57] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#174777]">+ Add</button></div>
          </div>
        </article>)}
      </div> : <div className="mt-4 rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center sm:p-12">
        <div className="text-5xl">🛍️</div><h3 className="mt-4 text-xl font-black text-[#102e57]">{search ? "No matching items" : "Your local marketplace is getting ready"}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{search ? "Try another product or store name." : "We’re preparing merchant catalogs in Hilongos, Bato, Hindang, Inopacan, and Matalom. Approved stores and products will appear here as they join."}</p>
      </div>}
    </section>

    <aside className="h-fit rounded-3xl border border-orange-100 bg-white p-5 shadow-sm lg:sticky lg:top-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#102e57]">Your basket</h2><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">{count} items</span></div>
      {items.length ? <div className="mt-4 space-y-4">
        {items.map(({product, quantity}) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0"><p className="truncate text-sm font-bold text-[#102e57]">{product.name}</p><p className="text-xs text-slate-500">₱{Number(product.price).toFixed(2)}</p></div>
          <div className="flex items-center gap-2"><button onClick={() => change(product.id,-1)} aria-label={`Remove one ${product.name}`} className="h-7 w-7 rounded-full border border-slate-200 font-bold">−</button><span className="w-4 text-center text-sm font-bold">{quantity}</span><button onClick={() => change(product.id,1)} aria-label={`Add one ${product.name}`} className="h-7 w-7 rounded-full bg-orange-100 font-bold text-orange-700">+</button></div>
        </div>)}
        <div className="flex justify-between pt-1 font-black text-[#102e57]"><span>Subtotal</span><span>₱{total.toFixed(2)}</span></div>
        <button disabled className="w-full cursor-not-allowed rounded-full bg-slate-200 px-4 py-3 text-sm font-extrabold text-slate-500">Checkout coming in next phase</button>
        <p className="text-center text-xs leading-5 text-slate-400">Your basket is temporary on this device for now.</p>
      </div> : <div className="py-8 text-center"><div className="text-4xl">🧺</div><p className="mt-3 text-sm font-semibold text-slate-600">Your basket is empty</p><p className="mt-1 text-xs text-slate-400">Add items from local stores to get started.</p></div>}
    </aside>
  </div>;
}
