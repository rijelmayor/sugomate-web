import Link from "next/link";
import { Inbox } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMerchantOrderStatus } from "./actions";
import FormSubmitButton from "@/components/FormSubmitButton";
import PendingLink from "@/components/PendingLink";
import MerchantNewOrderAlert from "@/components/merchant/MerchantNewOrderAlert";
import MerchantShell from "@/components/merchant/MerchantShell";
import OrderProgress from "@/components/orders/OrderProgress";

const statusLabels: Record<string, string> = {
  pending_merchant: "New order",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  assigned: "Driver assigned",
  picked_up: "Picked up",
  in_transit: "On the way",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const groups = {
  new: ["pending_merchant"],
  active: ["accepted", "preparing", "ready_for_pickup", "assigned", "picked_up", "in_transit"],
  history: ["delivered", "rejected", "cancelled"],
} as const;
type Tab = keyof typeof groups;
const emptyText: Record<Tab, string> = { new: "No new orders right now. You will hear an alert when one arrives.", active: "No orders in progress.", history: "Completed orders will show up here." };

export default async function MerchantPortal({ searchParams }: {
  searchParams: Promise<{ error?: string; updated?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("merchant_members")
    .select("merchant_id,member_role,merchants(id,name,status,logo_url)")
    .eq("user_id", user.id);

  const merchantRows = (memberships ?? []).map((m) => ({
    id: m.merchant_id,
    role: m.member_role,
    merchant: m.merchants as unknown as { id: string; name: string; status: string; logo_url: string | null } | null,
  })).filter((m) => m.merchant);

  const approvedRows = merchantRows.filter((m) => m.merchant?.status === "approved");
  const approvedIds = approvedRows.map((m) => m.id);
  const storeInfo = (approvedRows[0] ?? merchantRows[0])?.merchant;
  const { data: orders } = approvedIds.length
    ? await supabase.from("orders")
        .select("id,order_number,status,driver_user_id,payment_method,payment_status,subtotal,delivery_fee,total,placed_at,customer_id,address_snapshot,customer_note,order_items(id,product_name,quantity,line_total)")
        .in("merchant_id", approvedIds)
        .order("placed_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const all = orders ?? [];
  const count = (tab: Tab) => all.filter(o => (groups[tab] as readonly string[]).includes(o.status)).length;
  const counts = { new: count("new"), active: count("active"), history: count("history") };
  const tab = (["new", "active", "history"] as const).find(t => t === params.tab) ?? (counts.new ? "new" : counts.active ? "active" : "new");
  const visible = all.filter(o => (groups[tab] as readonly string[]).includes(o.status));
  const white = { color: "#ffffff", WebkitTextFillColor: "#ffffff" } as const;

  return <MerchantShell active="orders" store={storeInfo ? { name: storeInfo.name, logoUrl: storeInfo.logo_url } : null} newCount={counts.new}>
    <MerchantNewOrderAlert merchantIds={approvedIds} />

    {params.updated && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Order status updated.</p>}
    {params.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">We could not update that order. Refresh and try again.</p>}

    {merchantRows.some(m => m.merchant?.status !== "approved") && <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-extrabold">Store approval pending</h2><p className="mt-1 text-sm text-amber-900/75">SUGOMATE operations must approve your store before you can receive orders.</p>{merchantRows.filter(m => m.merchant?.status !== "approved").map(m => <p key={m.id} className="mt-2 text-sm font-semibold">{m.merchant?.name}: <span className="capitalize">{m.merchant?.status}</span></p>)}</section>}

    {!merchantRows.length && <section className="mt-6 rounded-2xl border border-dashed border-orange-200 bg-white p-8 text-center"><Inbox aria-hidden="true" size={40} strokeWidth={1.5} className="mx-auto text-orange-300" /><h2 className="mt-3 text-xl font-black">No merchant account yet</h2><p className="mt-2 text-sm text-slate-500">Apply to become a merchant from your account dashboard.</p><Link href="/dashboard" className="mt-4 inline-flex rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Go to my dashboard</Link></section>}

    {approvedIds.length > 0 && <>
      <div role="group" aria-label="Order filters" className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {([["new", "New"], ["active", "In progress"], ["history", "History"]] as const).map(([key, label]) => <PendingLink key={key} href={`/merchant?tab=${key}`} aria-current={tab === key ? "page" : undefined} style={tab === key ? white : undefined} className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${tab === key ? "bg-[#102e57] shadow-sm" : "border border-slate-200 bg-white text-[#102e57]"}`}>{label}<span className={`ml-1 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-black ${tab === key ? "bg-white/20" : key === "new" && counts.new ? "bg-[#ff8a00]" : "bg-slate-100 text-slate-500"}`} style={tab === key || (key === "new" && counts.new) ? white : undefined}>{counts[key]}</span></PendingLink>)}
      </div>

      <section className="mt-4 space-y-3">
        {visible.length ? visible.map((order) => {
          const address = order.address_snapshot as { recipient_name?: string; recipient_phone?: string; address_line?: string; landmark?: string };
          const canAccept = order.status === "pending_merchant";
          const next = order.status === "accepted" && order.driver_user_id ? "preparing" : order.status === "preparing" ? "ready_for_pickup" : null;
          return <article key={order.id} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${canAccept ? "border-orange-300 ring-2 ring-orange-100" : "border-orange-100"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h2 className="truncate text-base font-black">{address?.recipient_name || "Customer"}</h2><p className="mt-0.5 text-xs text-slate-500">{order.order_number} · {new Date(order.placed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p></div>
              <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-extrabold text-orange-800">{order.status === "accepted" ? (order.driver_user_id ? "Rider assigned" : "Waiting for rider") : statusLabels[order.status] ?? order.status}</span>
            </div>
            {tab === "active" && <OrderProgress status={order.status} />}
            <ul className="mt-3 space-y-1.5 text-sm">{(order.order_items ?? []).map((item: { id: string; product_name: string; quantity: number; line_total: number }) => <li key={item.id} className="flex justify-between gap-3"><span>{item.quantity} × {item.product_name}</span><strong>₱{Number(item.line_total).toFixed(2)}</strong></li>)}</ul>
            {order.customer_note && <p className="mt-3 rounded-lg bg-orange-50 p-2 text-xs text-slate-600">Note: {order.customer_note}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">Total <strong className="text-lg text-[#102e57]">₱{Number(order.total).toFixed(2)}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{order.payment_method.toUpperCase()} · {order.payment_status}</span></p>
              {canAccept ? <div className="flex gap-2"><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="next_status" value="rejected" /><FormSubmitButton pendingLabel="Rejecting…" className="min-h-11 rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">Reject</FormSubmitButton></form><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="next_status" value="accepted" /><FormSubmitButton pendingLabel="Accepting…" className="min-h-11 rounded-full bg-[#102e57] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#174777]">Accept order</FormSubmitButton></form></div>
                : order.status === "accepted" && !order.driver_user_id ? <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Waiting for a driver to claim</span> : next ? <form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="next_status" value={next} /><FormSubmitButton pendingLabel="Updating…" className="min-h-11 rounded-full bg-[#ff8a00] px-5 py-2 text-sm font-extrabold text-white transition hover:bg-[#ed5a19]">{next === "preparing" ? "Start preparing" : "Mark ready for pickup"}</FormSubmitButton></form>
                : null}
            </div>
            <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-slate-500">Delivery details</summary><p className="mt-2 text-sm font-semibold">{address?.address_line || "Address unavailable"}</p><p className="mt-1 text-sm text-slate-500">{address?.recipient_phone || ""}{address?.landmark ? " · Near " + address.landmark : ""}</p></details>
          </article>;
        }) : <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center"><Inbox aria-hidden="true" size={38} strokeWidth={1.5} className="mx-auto text-orange-300" /><p className="mt-3 text-sm text-slate-500">{emptyText[tab]}</p></div>}
      </section>
    </>}
  </MerchantShell>;
}
