import Link from "next/link";
import { Inbox } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMerchantOrderStatus } from "./actions";
import { confirmGcashPayment } from "./payment-actions";
import FormSubmitButton from "@/components/FormSubmitButton";
import PendingLink from "@/components/PendingLink";
import MerchantNewOrderAlert from "@/components/merchant/MerchantNewOrderAlert";
import MerchantShell from "@/components/merchant/MerchantShell";
import OrderProgress from "@/components/orders/OrderProgress";

const money = (value: number | string) => "₱" + Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  searchParams: Promise<{ error?: string; updated?: string; tab?: string; paymentConfirmed?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  await supabase.rpc("expire_unassigned_order_rider_targets");
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
        .select("id,order_number,status,driver_user_id,driver_assignment_status,rider_claim_deadline_at,rider_assignment_expired_at,rider_on_way_at,stock_reserved_at,payment_method,payment_status,gcash_payment_reference,gcash_payment_proof_path,gcash_payment_submitted_at,gcash_payment_verified_at,subtotal,delivery_fee,total,placed_at,customer_id,address_snapshot,customer_note,order_items(id,product_name,quantity,line_total)")
        .in("merchant_id", approvedIds)
        .order("placed_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const proofEntries = await Promise.all((orders ?? []).filter(order => order.gcash_payment_proof_path).map(async order => {
    const { data } = await supabase.storage.from("gcash-payment-proofs").createSignedUrl(order.gcash_payment_proof_path as string, 3600);
    return [order.id, data?.signedUrl] as const;
  }));
  const paymentProofUrls = new Map<string,string>();
  for (const [id,url] of proofEntries) if (url) paymentProofUrls.set(id,url);

  const all = orders ?? [];
  const count = (tab: Tab) => all.filter(o => (groups[tab] as readonly string[]).includes(o.status)).length;
  const counts = { new: count("new"), active: count("active"), history: count("history") };
  const tab = (["new", "active", "history"] as const).find(t => t === params.tab) ?? (counts.new ? "new" : counts.active ? "active" : "new");
  const visible = all.filter(o => (groups[tab] as readonly string[]).includes(o.status));
  const white = { color: "#ffffff", WebkitTextFillColor: "#ffffff" } as const;

  return <MerchantShell active="orders" store={storeInfo ? { name: storeInfo.name, logoUrl: storeInfo.logo_url } : null} newCount={counts.new} headerActions={<MerchantNewOrderAlert merchantIds={approvedIds} />}>

    {params.updated && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Order status updated.</p>}
    {params.paymentConfirmed && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">GCash payment confirmed and marked as paid.</p>}
    {params.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{params.error==="payment"?"We could not confirm that GCash payment. Refresh and check the submitted proof.":"We could not update that order. Refresh and try again."}</p>}

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
          const next = order.status === "accepted" && order.driver_assignment_status === "en_route" ? "preparing" : order.status === "preparing" ? "ready_for_pickup" : null;
          const paymentProofUrl = paymentProofUrls.get(order.id);
          return <article key={order.id} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${canAccept ? "border-orange-300 ring-2 ring-orange-100" : "border-orange-100"}`}>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><h2 className="truncate text-base font-black">{address?.recipient_name || "Customer"}</h2><p className="mt-0.5 text-xs text-slate-500">{order.order_number} · {new Date(order.placed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p></div>
              <span className="max-w-full rounded-full bg-orange-100 px-3 py-1 text-xs font-extrabold leading-5 text-orange-800 whitespace-normal break-words sm:shrink-0">{order.status === "accepted" ? (order.rider_on_way_at ? "Rider on the way" : order.driver_user_id ? "Rider claimed · awaiting confirmation" : "Waiting for rider") : statusLabels[order.status] ?? order.status}</span>
            </div>
            {tab === "active" && <OrderProgress status={order.status} />}
            <ul className="mt-3 space-y-1.5 text-sm">{(order.order_items ?? []).map((item: { id: string; product_name: string; quantity: number; line_total: number }) => <li key={item.id} className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0 break-words">{item.quantity} × {item.product_name}</span><strong className="shrink-0 whitespace-nowrap">{money(item.line_total)}</strong></li>)}</ul>
            {order.customer_note && <p className="mt-3 rounded-lg bg-orange-50 p-2 text-xs text-slate-600">Note: {order.customer_note}</p>}
            <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-slate-100 pt-3">
              <div className="w-full min-w-0 rounded-xl border border-orange-100 bg-orange-50/50 p-3 text-sm"><p className="flex min-w-0 justify-between gap-3"><span className="min-w-0 break-words text-slate-600">Items subtotal</span><strong className="shrink-0 whitespace-nowrap">{money(order.subtotal)}</strong></p><p className="mt-2 flex min-w-0 justify-between gap-3"><span className="min-w-0 break-words font-semibold text-orange-800">Delivery fee</span><strong className="shrink-0 whitespace-nowrap text-orange-800">{money(order.delivery_fee)}</strong></p><p className="mt-2 flex min-w-0 justify-between gap-3 border-t border-orange-200 pt-2"><span className="min-w-0 break-words font-black text-slate-800">Total</span><strong className="shrink-0 whitespace-nowrap text-lg text-[#102e57]">{money(order.total)}</strong></p><span className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600">{order.payment_method.toUpperCase()} · {order.payment_status}</span></div>
              {order.payment_method==="gcash" && <div className="w-full rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[#102e57]">GCash payment</strong><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${order.payment_status==="paid"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{order.payment_status==="paid"?"Paid":order.gcash_payment_submitted_at?"Pending verification":"Awaiting customer payment"}</span></div>{order.payment_status==="paid" ? <p className="mt-2 text-xs text-emerald-800">Payment confirmed{order.gcash_payment_verified_at ? " · "+new Date(order.gcash_payment_verified_at).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"}) : ""}.</p> : order.gcash_payment_submitted_at ? <><p className="mt-2 text-xs text-slate-600">Customer submitted transaction reference <strong>{order.gcash_payment_reference}</strong> on {new Date(order.gcash_payment_submitted_at).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}.</p>{paymentProofUrl ? <a href={paymentProofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-[#102e57]">View payment receipt ↗</a> : <p className="mt-2 text-xs text-rose-700">Receipt is unavailable. Ask the customer to upload it again.</p>}<form action={confirmGcashPayment} className="mt-3"><input type="hidden" name="order_id" value={order.id}/><FormSubmitButton pendingLabel="Confirming payment…" className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-black text-white">Confirm GCash payment received</FormSubmitButton><p className="mt-2 text-[11px] leading-4 text-slate-500">Only confirm after checking your GCash transaction history and matching the amount and reference number.</p></form></> : <p className="mt-2 text-xs text-slate-600">Waiting for the customer to pay and upload the transaction receipt.</p>}</div>}
              {canAccept ? <div className="flex w-full min-w-0 flex-wrap gap-2"><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="next_status" value="rejected" /><FormSubmitButton pendingLabel="Rejecting…" className="min-h-11 rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">Reject</FormSubmitButton></form><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="next_status" value="accepted" /><FormSubmitButton pendingLabel="Checking stock…" className="min-h-11 rounded-full bg-[#102e57] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#174777]">Accept & reserve stock</FormSubmitButton></form></div>
                : order.status === "accepted" && !order.driver_user_id ? <div className="w-full space-y-2"><p className={`rounded-xl px-3 py-2 text-xs font-bold ${order.rider_assignment_expired_at ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{order.rider_assignment_expired_at ? "5-minute target missed — still waiting for a rider. You may keep waiting or cancel." : `Waiting for rider claim · target by ${order.rider_claim_deadline_at ? new Date(order.rider_claim_deadline_at).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"}) : "within 5 minutes"}`}</p><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="cancelled"/><FormSubmitButton pendingLabel="Cancelling…" className="min-h-10 rounded-full border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700">Cancel order & release stock</FormSubmitButton></form></div>
                : order.status === "accepted" && order.driver_assignment_status === "claimed" ? <div className="w-full space-y-2"><p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Rider has claimed this order but has not confirmed departure. Preparation remains locked.</p><div className="flex flex-wrap gap-2"><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="cancelled"/><FormSubmitButton pendingLabel="Cancelling…" className="min-h-10 rounded-full border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700">Cancel & release stock</FormSubmitButton></form></div></div>
                : next ? <div className="flex w-full flex-wrap items-center gap-2"><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="next_status" value={next} /><FormSubmitButton pendingLabel="Updating…" className="min-h-11 rounded-full bg-[#ff8a00] px-5 py-2 text-sm font-extrabold text-white transition hover:bg-[#ed5a19]">{next === "preparing" ? "Start preparing" : "Mark ready for pickup"}</FormSubmitButton></form>{order.status==="preparing"&&<form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="cancelled"/><FormSubmitButton pendingLabel="Cancelling…" className="min-h-10 rounded-full border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700">Cancel order</FormSubmitButton></form>}</div>
                : null}
            </div>
            <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-slate-500">Delivery details</summary><p className="mt-2 text-sm font-semibold">{address?.address_line || "Address unavailable"}</p><p className="mt-1 text-sm text-slate-500">{address?.recipient_phone || ""}{address?.landmark ? " · Near " + address.landmark : ""}</p></details>
          </article>;
        }) : <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center"><Inbox aria-hidden="true" size={38} strokeWidth={1.5} className="mx-auto text-orange-300" /><p className="mt-3 text-sm text-slate-500">{emptyText[tab]}</p></div>}
      </section>
    </>}
  </MerchantShell>;
}
