import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const labels: Record<string,string> = {pending_merchant:"Awaiting store",accepted:"Accepted",preparing:"Preparing",ready_for_pickup:"Ready for pickup",assigned:"Driver assigned",picked_up:"Picked up",in_transit:"On the way",delivered:"Delivered",cancelled:"Cancelled",rejected:"Rejected"};

export default async function CustomerOrders({searchParams}:{searchParams:Promise<{placed?:string}>}) {
  const params=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:orders}=await supabase.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,delivery_fee,total,placed_at,delivery_proof_path,driver_note,merchants(name),order_items(id,product_name,quantity,line_total)").eq("customer_id",user.id).order("placed_at",{ascending:false}).limit(50);
  const orderIds=(orders??[]).map(order=>order.id);
  const {data:history}=orderIds.length?await supabase.from("order_status_history").select("id,order_id,to_status,note,created_at").in("order_id",orderIds).order("created_at",{ascending:true}):{data:[]};
  const historyByOrder=new Map<string,typeof history>(orderIds.map(id=>[id,(history??[]).filter(event=>event.order_id===id)]));
  const proofUrls=new Map<string,string>();
  for(const order of orders??[]){
    if(order.delivery_proof_path){
      const {data}=await supabase.storage.from("delivery-proofs").createSignedUrl(order.delivery_proof_path,3600);
      if(data?.signedUrl) proofUrls.set(order.id,data.signedUrl);
    }
  }
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]"><div className="mx-auto max-w-3xl">
    <Link href="/customer" className="text-sm font-bold text-orange-600">← Back to marketplace</Link>
    <h1 className="mt-5 text-3xl font-black">My orders</h1><p className="mt-2 text-sm text-slate-500">Follow your orders from store confirmation through delivery.</p>
    {params.placed&&<div role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Your order was submitted. The store will review and confirm it shortly.</div>}
    <div className="mt-6 space-y-4">{(orders??[]).length?(orders??[]).map(o=><article key={o.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{o.order_number}</p><h2 className="mt-1 text-lg font-black">{(o.merchants as unknown as {name:string}|null)?.name ?? "Local merchant"}</h2><p className="mt-1 text-xs text-slate-500">{new Date(o.placed_at).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}</p></div><span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-extrabold text-orange-800">{labels[o.status] ?? o.status}</span></div>
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">{(o.order_items??[]).map((item:{id:string;product_name:string;quantity:number;line_total:number})=><div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{item.quantity} × {item.product_name}</span><span className="font-semibold">₱{Number(item.line_total).toFixed(2)}</span></div>)}</div>
      <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-sm"><span className="text-slate-500">Subtotal + delivery</span><strong>₱{Number(o.total).toFixed(2)}</strong></div>
      <p className="mt-2 text-xs text-slate-400">Payment: {o.payment_method.toUpperCase()} · {o.payment_status}</p>
      <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Order activity</p><ol className="mt-2 space-y-2">{(historyByOrder.get(o.id)??[]).map(event=><li key={event.id} className="flex gap-3 text-xs"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500"/><span><strong className="capitalize text-slate-700">{labels[event.to_status]??event.to_status}</strong><span className="ml-2 text-slate-400">{new Date(event.created_at).toLocaleString("en-PH",{dateStyle:"short",timeStyle:"short"})}</span>{event.note&&<span className="mt-0.5 block text-slate-500">{event.note}</span>}</span></li>)}</ol></div>
      {proofUrls.get(o.id)&&<a href={proofUrls.get(o.id)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">View delivery photo ↗</a>}
      {o.driver_note&&<p className="mt-2 text-xs text-slate-500">Delivery note: {o.driver_note}</p>}
    </article>):<div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center"><div className="text-4xl">🛵</div><h2 className="mt-3 text-lg font-black">No orders yet</h2><p className="mt-1 text-sm text-slate-500">Your placed orders will appear here.</p><Link href="/customer" className="mt-4 inline-block rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Browse marketplace</Link></div>}</div>
  </div></main>;
}
