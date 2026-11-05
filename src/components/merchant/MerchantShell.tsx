import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, Package, Settings } from "lucide-react";
import PendingLink from "@/components/PendingLink";
import StoreAvatar from "@/components/merchant/StoreAvatar";
import PortalSignOut from "@/components/PortalSignOut";

type TabKey = "orders" | "products" | "settings";
const TABS = [
  { key: "orders", href: "/merchant", label: "Orders", Icon: ClipboardList },
  { key: "products", href: "/merchant/products", label: "Products", Icon: Package },
  { key: "settings", href: "/merchant/storefront", label: "Store settings", Icon: Settings },
] as const;

export default function MerchantShell({ active, store, newCount = 0, width = "max-w-6xl", headerActions, children }: {
  active: TabKey;
  store: { name: string; logoUrl?: string | null } | null;
  newCount?: number;
  width?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const white = { color: "#ffffff", WebkitTextFillColor: "#ffffff" } as const;
  return <main className="min-h-screen bg-[#fff7ef] px-4 pb-28 pt-5 text-[#102e57] sm:px-6 sm:pb-10 sm:pt-7">
    <div className={`mx-auto ${width}`}>
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <Link href="/merchant" className="flex min-w-0 items-center gap-3">
          <StoreAvatar name={store?.name ?? "Store"} logoUrl={store?.logoUrl} />
          <span className="min-w-0"><span className="block truncate text-base font-black leading-tight sm:text-lg">{store?.name ?? "Your store"}</span><span className="block text-[11px] font-bold uppercase tracking-wider text-orange-600">SUGOMATE Merchant</span></span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">{headerActions}<PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#102e57]" /></div>
      </header>

      <nav aria-label="Merchant navigation" className="mt-4 hidden gap-2 sm:flex">
        {TABS.map(({ key, href, label, Icon }) => <PendingLink key={key} href={href} aria-current={key === active ? "page" : undefined} style={key === active ? white : undefined} className={`min-h-10 rounded-full px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5 ${key === active ? "bg-[#102e57] shadow-sm" : "border border-orange-100 bg-white text-[#102e57]"}`}>
          <Icon aria-hidden="true" size={16} />{label}
          {key === "orders" && newCount > 0 && <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff8a00] px-1.5 text-[11px] font-black" style={white}>{newCount}</span>}
        </PendingLink>)}
      </nav>

      {children}
    </div>

    <nav aria-label="Merchant navigation" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-orange-100 bg-white/95 backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map(({ key, href, label, Icon }) => <PendingLink key={key} href={href} aria-current={key === active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${key === active ? "text-[#e95718]" : "text-slate-500"}`}>
          <span className="relative"><Icon aria-hidden="true" size={21} strokeWidth={key === active ? 2.4 : 1.9} />{key === "orders" && newCount > 0 && <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#ff8a00] px-1 text-[10px] font-black" style={white}>{newCount}</span>}</span>
          {label}
          {key === active && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[#e95718]" />}
        </PendingLink>)}
      </div>
    </nav>
  </main>;
}
