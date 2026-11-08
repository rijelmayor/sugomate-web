"use client";

import { useState } from "react";
import { Croissant, CupSoda, Flower2, Pill, ShoppingBag, ShoppingBasket, Store, UtensilsCrossed, Wrench, type LucideIcon } from "lucide-react";
import PendingLink from "@/components/PendingLink";

const GLYPHS: Record<string, { Icon: LucideIcon; tint: string }> = {
  "food-meals": { Icon: UtensilsCrossed, tint: "from-[#7a2e12] to-[#d9591e]" },
  groceries: { Icon: ShoppingBasket, tint: "from-[#1d5c3a] to-[#4fa36b]" },
  "flower-shop": { Icon: Flower2, tint: "from-[#8a2f55] to-[#e07aa0]" },
  "drinks-desserts": { Icon: CupSoda, tint: "from-[#7b3f1d] to-[#d99a5b]" },
  pharmacy: { Icon: Pill, tint: "from-[#0e5a73] to-[#3fa7c4]" },
  bakery: { Icon: Croissant, tint: "from-[#8a5a1c] to-[#e2a64a]" },
  hardware: { Icon: Wrench, tint: "from-[#2b3b52] to-[#6b7f99]" },
  "pabili-essentials": { Icon: ShoppingBag, tint: "from-[#102e57] to-[#2f6fb5]" },
};
const FALLBACK = { Icon: Store, tint: "from-[#102e57] to-[#4a6a92]" };

export function categoryGlyph(slug: string) { return GLYPHS[slug] ?? FALLBACK; }

/** Small inline icon for chips and headings (replaces emoji). */
export function CategoryGlyph({ slug, size = 15 }: { slug: string; size?: number }) {
  const { Icon } = categoryGlyph(slug);
  return <Icon aria-hidden="true" size={size} strokeWidth={2} className="shrink-0" />;
}

/** Photo-first category card. Falls back to a rich gradient + line icon if the photo is missing or fails to load. */
export default function CategoryTile({ href, name, slug, imageUrl, count }: { href: string; name: string; slug: string; imageUrl?: string | null; count: number }) {
  const [state, setState] = useState<"loading" | "ok" | "error">(imageUrl ? "loading" : "error");
  const { Icon, tint } = categoryGlyph(slug);
  return <PendingLink href={href} className="group relative block aspect-square w-full min-w-0 overflow-hidden rounded-3xl bg-[#102e57] shadow-[0_8px_24px_rgba(16,46,87,0.14)] transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[.98] sm:aspect-square">
    <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${tint} ${state === "loading" ? "skeleton" : ""}`}>
      {state !== "ok" && <Icon size={56} strokeWidth={1.25} className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 text-white/80" />}
    </div>
    {imageUrl && state !== "error" && <img src={imageUrl} alt="" loading="lazy" decoding="async" onLoad={() => setState("ok")} onError={() => setState("error")} className={`absolute inset-0 h-full w-full object-contain p-3 transition duration-500 ${state === "ok" ? "opacity-100" : "opacity-0"}`} />}
    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0a1f3d]/90 via-[#0a1f3d]/25 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
      <span className="block text-sm font-extrabold leading-tight text-white sm:text-base" style={{ color: "#fff", WebkitTextFillColor: "#fff" }}>{name}</span>
      <span className="mt-1 inline-flex rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm" style={{ color: "#fff", WebkitTextFillColor: "#fff" }}>{count} {count === 1 ? "store" : "stores"}</span>
    </div>
  </PendingLink>;
}
