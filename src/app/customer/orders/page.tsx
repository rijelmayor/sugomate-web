import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const labels: Record<string,string> = {pending_merchant:"Awaiting store",accepted:"Accepted",preparing:"Preparing",ready_for_pickup:"Ready for pickup",assigned:"Driver assigned",picked_up:"Picked up",in_transit:"On the way",delivered:"Delivered",cancelled:"Cancelled",rejected:"Rejected"};

export default async function CustomerOrders({searchParams}:{searchParams:Promise<{placed?:string}>}) {
  const params=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:orders}=await supabase.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,delivery_fee,total,placed_at,merchants(name),order_items(id,product_name,quantity,line_total)").eq("customer_id",user.id).order("placed_at",{ascending:false}).limit(50);
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]"><div className="mx-auto max-w-3xl">
    <Link href="/customer" className="text-sm font-bold text-orange-600">← Back to marketplace</Link>
    <h1 className="mt-5 text-3xl font-black">My orders</h1><p className="mt-2 text-sm text-slate-500">Follow your orders from store confirmation through delivery.</p>
    {params.placed&&<div role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Your order was submitted. The store will review and confirm it shortly.</div>}
    <div className="mt-6 space-y-4">{(orders??[]).length?(orders??[]).map(o=><article key={o.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{o.order_number}</p><h2 className="mt-1 text-lg font-black">{(o.merchants as unknown as {name:string}|null)?.name ?? "Local merchant"}</h2><p className="mt-1 text-xs text-slate-500">{new Date(o.placed_at).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}</p></div><span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-extrabold text-orange-800">{labels[o.status] ?? o.status}</span></div>
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">{(o.order_items??[]).map((item:{id:string;product_name:string;quantity:number;line_total:number})=><div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{item.quantity} × {item.product_name}</span><span className="font-semibold">₱{Number(item.line_total).toFixed(2)}</span></div>)}</div>
      <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-sm"><span className="text-slate-500">Subtotal + delivery</span><strong>₱{Number(o.total).toFixed(2)}</strong></div>
      <p className="mt-2 text-xs text-slate-400">Payment: {o.payment_method.toUpperCase()} · {o.payment_status}</p>
    </article>):<div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center"><div className="text-4xl">🛵</div><h2 className="mt-3 text-lg font-black">No orders yet</h2><p className="mt-1 text-sm text-slate-500">Your placed orders will appear here.</p><Link href="/customer" className="mt-4 inline-block rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Browse marketplace</Link></div>}</div>
  </div></main>;
}
