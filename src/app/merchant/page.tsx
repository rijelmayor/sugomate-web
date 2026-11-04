import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMerchantOrderStatus } from "./actions";
import FormSubmitButton from "@/components/FormSubmitButton";
import MerchantNewOrderAlert from "@/components/merchant/MerchantNewOrderAlert";

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

export default async function MerchantPortal({ searchParams }: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("merchant_members")
    .select("merchant_id,member_role,merchants(id,name,status)")
    .eq("user_id", user.id);

  const merchantRows = (memberships ?? []).map((m) => ({
    id: m.merchant_id,
    role: m.member_role,
    merchant: m.merchants as unknown as { id: string; name: string; status: string } | null,
  })).filter((m) => m.merchant);

  const approvedIds = merchantRows.filter((m) => m.merchant?.status === "approved").map((m) => m.id);
  const { data: orders } = approvedIds.length
    ? await supabase.from("orders")
        .select("id,order_number,status,payment_method,payment_status,subtotal,delivery_fee,total,placed_at,customer_id,address_snapshot,customer_note,order_items(id,product_name,quantity,line_total)")
        .in("merchant_id", approvedIds)
        .order("placed_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return <main className="min-h-screen bg-[#fff7ef] px-4 py-7 text-[#102e57] sm:px-6">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="text-sm font-black tracking-wide">SUGOMATE <span className="font-medium text-slate-400">/ Merchant</span></Link>
        <nav aria-label="Merchant navigation" className="flex flex-wrap items-center gap-2"><Link href="/merchant/products" className="rounded-full bg-[#ffbd18] px-4 py-2 text-sm font-bold text-[#102e57]">Products</Link><Link href="/customer" className="rounded-full border border-orange-100 bg-white px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-md">Marketplace</Link><Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#102e57]">My account</Link></nav>
      </header>

      <MerchantNewOrderAlert merchantIds={approvedIds} />

      <section className="mt-7 rounded-3xl bg-[#102e57] p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#ffbd18]">Merchant workspace</p>
        <h1 className="mt-2 text-3xl font-black">Orders from your customers</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Review incoming orders, accept them, and update preparation progress so customers know what is happening.</p>
        <div className="mt-5 flex flex-wrap gap-5 border-t border-white/15 pt-4 text-sm"><span><strong className="text-xl">{orders?.length ?? 0}</strong><span className="ml-2 text-white/70">Recent orders</span></span><span><strong className="text-xl">{(orders ?? []).filter(o => o.status === "pending_merchant").length}</strong><span className="ml-2 text-white/70">Need attention</span></span></div>
      </section>

      {params.updated && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Order status updated.</p>}
      {params.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">We could not update that order. Refresh and try again.</p>}

      {merchantRows.some(m => m.merchant?.status !== "approved") && <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-extrabold">Store approval pending</h2><p className="mt-1 text-sm text-amber-900/75">Your store must be approved by SUGOMATE operations before you can receive and manage customer orders.</p>{merchantRows.filter(m => m.merchant?.status !== "approved").map(m => <p key={m.id} className="mt-2 text-sm font-semibold">{m.merchant?.name}: <span className="capitalize">{m.merchant?.status}</span></p>)}</section>}

      {!merchantRows.length && <section className="mt-6 rounded-2xl border border-dashed border-orange-200 bg-white p-8 text-center"><div className="text-4xl">🏪</div><h2 className="mt-3 text-xl font-black">No merchant account yet</h2><p className="mt-2 text-sm text-slate-500">Apply to become a merchant from your account dashboard.</p><Link href="/dashboard" className="mt-4 inline-flex rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Go to my dashboard</Link></section>}

      <section className="mt-6 space-y-4">
        {(orders ?? []).length ? (orders ?? []).map((order) => {
          const address = order.address_snapshot as { recipient_name?: string; recipient_phone?: string; address_line?: string; landmark?: string; label?: string };
          const canAccept = order.status === "pending_merchant";
          const next = order.status === "accepted" ? "preparing" : order.status === "preparing" ? "ready_for_pickup" : null;
          return <article key={order.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{order.order_number}</p><h2 className="mt-1 text-lg font-black">{address?.recipient_name || "Customer"}</h2><p className="mt-1 text-xs text-slate-500">{new Date(order.placed_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p></div>
              <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-extrabold text-orange-800">{statusLabels[order.status] ?? order.status}</span>
            </div>
            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div><h3 className="text-xs font-black uppercase tracking-wide text-slate-400">Items</h3><div className="mt-2 space-y-2">{(order.order_items ?? []).map((item: {id:string;product_name:string;quantity:number;line_total:number}) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {item.product_name}</span><strong>₱{Number(item.line_total).toFixed(2)}</strong></div>)}</div></div>
              <div><h3 className="text-xs font-black uppercase tracking-wide text-slate-400">Delivery details</h3><p className="mt-2 text-sm font-semibold">{address?.address_line || "Address unavailable"}</p><p className="mt-1 text-sm text-slate-500">{address?.recipient_phone || ""}{address?.landmark ? " · Near " + address.landmark : ""}</p><p className="mt-3 text-xs text-slate-500">Payment: {order.payment_method.toUpperCase()} · {order.payment_status}</p>{order.customer_note && <p className="mt-2 rounded-lg bg-orange-50 p-2 text-xs text-slate-600">Note: {order.customer_note}</p>}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">Order total <strong className="ml-2 text-lg text-[#102e57]">₱{Number(order.total).toFixed(2)}</strong></p>
              {canAccept ? <div className="flex gap-2"><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="rejected"/><FormSubmitButton pendingLabel="Rejecting…" className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">Reject</FormSubmitButton></form><form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="accepted"/><FormSubmitButton pendingLabel="Accepting…" className="rounded-full bg-[#102e57] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#174777]">Accept order</FormSubmitButton></form></div> : next ? <form action={updateMerchantOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value={next}/><FormSubmitButton pendingLabel="Updating…" className="rounded-full bg-[#ff8a00] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#ed5a19]">{next === "preparing" ? "Start preparing" : "Mark ready for pickup"}</FormSubmitButton></form> : <span className="text-xs font-semibold text-slate-400">No merchant action required</span>}
            </div>
          </article>;
        }) : merchantRows.some(m => m.merchant?.status === "approved") ? <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center"><div className="text-4xl">📬</div><h2 className="mt-3 text-lg font-black">No orders yet</h2><p className="mt-1 text-sm text-slate-500">New customer orders will appear here.</p></div> : null}
      </section>
    </div>
  </main>;
}
