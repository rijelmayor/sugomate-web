import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/dashboard/actions";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import FormSubmitButton from "@/components/FormSubmitButton";
import DriverOfferAlarm from "@/components/driver/DriverOfferAlarm";
import { respondToDriverAssignment, setDriverAvailability, updateDriverOrderStatus, claimReadyOrder } from "./actions";

const labels: Record<string,string> = {
 accepted:"Waiting for merchant", preparing:"Merchant preparing", ready_for_pickup:"Ready for pickup", assigned:"Driver assigned", picked_up:"Picked up", in_transit:"On the way", delivered:"Delivered"
};
const money=(value:number|string)=>"₱"+Number(value).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});

export default async function DriverPortal({searchParams}:{searchParams:Promise<{error?:string;updated?:string}>}) {
 const params=await searchParams;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login?next=/driver");
 const [{data:profile},{data:driver}]=await Promise.all([
  supabase.from("profiles").select("display_name,phone").eq("id",user.id).maybeSingle(),
  supabase.from("driver_profiles").select("status,vehicle_type,vehicle_plate,is_available").eq("user_id",user.id).maybeSingle()
 ]);
 if(!driver) redirect("/driver/apply");
 const active=driver.status==="active";
 const {data:orders}=active?await supabase.from("orders")
  .select("id,order_number,status,driver_assignment_status,total,delivery_fee,placed_at,address_snapshot,driver_note,order_items(id,product_name,quantity,line_total),merchants(name)")
  .eq("driver_user_id",user.id).in("status",["accepted","preparing","ready_for_pickup","assigned","picked_up","in_transit","delivered"])
  .order("placed_at",{ascending:false}).limit(100):{data:[]};
 const {data:readyOrders}=active&&driver.is_available?await supabase.from("orders")
  .select("id,order_number,total,delivery_fee,placed_at,address_snapshot,merchants(name)")
  .in("status",["accepted","ready_for_pickup"]).is("driver_user_id",null)
  .order("placed_at",{ascending:true}).limit(30):{data:[]};
 const current=(orders??[]).filter(o=>["accepted","preparing","ready_for_pickup","assigned","picked_up","in_transit"].includes(o.status));
 const completed=(orders??[]).filter(o=>o.status==="delivered");
 const offered=current.filter(o=>o.status==="assigned"&&o.driver_assignment_status==="offered");
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8">
  <div className="mx-auto max-w-5xl">
   <header className="flex flex-wrap items-center justify-between gap-3">
    <Link href="/" className="flex items-center gap-2 text-sm font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-white">S</span>SUGOMATE <span className="font-medium text-slate-400">/ Delivery partner</span></Link>
    <div className="flex items-center gap-2"><form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold"/></form></div>
   </header>
   {active&&<DriverOfferAlarm userId={user.id} offeredIds={offered.map(o=>o.id)}/>}
   <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#102e57] p-6 text-white shadow-xl sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ffbd18]">Delivery partner workspace</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Maayong adlaw, {(profile?.display_name||"Partner").split(/\s+/)[0]}!</h1><p className="mt-2 text-sm text-white/70">{driver.vehicle_type}{driver.vehicle_plate?" · "+driver.vehicle_plate:""} · {profile?.phone||"Contact not set"}</p></div><span className={`rounded-full px-4 py-2 text-xs font-black ${active?"bg-emerald-300/15 text-emerald-100":"bg-amber-300/15 text-amber-100"}`}>{driver.status==="active"?"Approved partner":driver.status==="pending"?"Application pending":driver.status}</span></div>
    {active&&<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5"><div><p className="font-bold">Availability</p><p className="mt-1 text-xs text-white/65">{driver.is_available?"You are online. Browse all available orders and claim one, regardless of distance.":"You are offline and will not see new orders."}</p><span className="text-xs text-white/60">GPS not required during testing</span></div><form action={setDriverAvailability}><input type="hidden" name="is_available" value={String(!driver.is_available)}/><FormSubmitButton pendingLabel="Updating…" className={`rounded-full px-5 py-3 text-sm font-black ${driver.is_available?"bg-white/10 text-white":"bg-[#ffbd18] text-[#102e57]"}`}>{driver.is_available?"Go offline":"Go online"}</FormSubmitButton></form></div>}
   </section>
   {(params.error||params.updated)&&<p role={params.error?"alert":"status"} className={`mt-4 rounded-xl p-4 text-sm ${params.error?"bg-rose-50 text-rose-700":"bg-emerald-50 text-emerald-800"}`}>{params.error==="proof"?"A delivery photo is required (JPG, PNG or WEBP, maximum 5 MB).":params.error==="upload"?"The delivery photo could not be uploaded. Please try again.":params.error?"We couldn't complete that action. Refresh and try again.":params.updated==="declined"?"Assignment declined and returned to dispatch.":params.updated==="claimed"?"Order claimed. Proceed to the pickup location.":params.updated==="accepted"?"Assignment accepted. Proceed to the pickup location.": "Delivery status updated successfully."}</p>}
   {!active?<section className="mt-6 rounded-3xl border border-amber-200 bg-white p-7"><h2 className="text-xl font-black">Your application is under review</h2><p className="mt-2 text-sm leading-6 text-slate-500">Delivery assignments and availability controls become available after SUGOMATE Operations approves your application.</p><Link href="/driver/apply" className="mt-4 inline-flex rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">View application</Link></section>:<>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-orange-100 bg-white p-5"><p className="text-xs font-bold text-slate-500">Active deliveries</p><p className="mt-2 text-3xl font-black">{current.length}</p></div><div className="rounded-2xl border border-orange-100 bg-white p-5"><p className="text-xs font-bold text-slate-500">Offers to respond</p><p className="mt-2 text-3xl font-black">{offered.length}</p></div><div className="rounded-2xl border border-orange-100 bg-white p-5"><p className="text-xs font-bold text-slate-500">Completed deliveries loaded</p><p className="mt-2 text-3xl font-black">{completed.length}</p></div></section>
    <section className="mt-8">
     <div className="mb-4"><p className="text-xs font-black uppercase tracking-widest text-orange-600">Available now</p><h2 className="mt-1 text-2xl font-black">Available orders</h2><p className="mt-1 text-sm text-slate-500">{current.length ? "Finish your current delivery before claiming another order." : "All available orders are shown to online drivers, regardless of distance. First successful claim gets the order."}</p></div>
     {current.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">You already have an active delivery. Complete it before claiming a new one.</div> : <div className="space-y-3">{(readyOrders??[]).map(order=>{
      const addr=order.address_snapshot as {address_line?:string;landmark?:string}|null;
      return <article key={order.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
       <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-black">{order.order_number}</p><p className="mt-1 text-xs text-slate-500">{(order.merchants as {name?:string}|null)?.name||"Store"} · {new Date(order.placed_at).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"})}</p></div>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">{money(order.delivery_fee)} fee</span>
       </div>
       <p className="mt-3 text-sm text-slate-600">{addr?.address_line||"Address on file"}{addr?.landmark?` · ${addr.landmark}`:""}</p>
       <form action={claimReadyOrder} className="mt-4"><input type="hidden" name="order_id" value={order.id}/><FormSubmitButton pendingLabel="Claiming…" className="rounded-full bg-[#102e57] px-5 py-2.5 text-sm font-black text-white">Claim this order</FormSubmitButton></form>
      </article>;
     })}{!(readyOrders??[]).length&&<div className="rounded-2xl border border-dashed border-orange-200 bg-white p-8 text-center text-sm text-slate-500">No available orders right now. New accepted orders will appear here automatically.</div>}</div>}
    </section>
    <section className="mt-8"><div className="mb-4"><p className="text-xs font-black uppercase tracking-widest text-orange-600">Dispatch queue</p><h2 className="mt-1 text-2xl font-black">Your assigned deliveries</h2><p className="mt-1 text-sm text-slate-500">Accept a dispatch offer, confirm pickup, update transit, then upload a delivery photo to complete the order.</p></div>
     <div className="space-y-4">{current.length?current.map(order=>{const address=order.address_snapshot as {recipient_name?:string;recipient_phone?:string;address_line?:string;landmark?:string};return <article key={order.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{order.order_number}</p><h3 className="mt-1 text-lg font-black">{(order.merchants as unknown as {name:string}|null)?.name||"Merchant pickup"}</h3><p className="mt-1 text-xs text-slate-500">{new Date(order.placed_at).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}</p></div><span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-extrabold text-orange-800">{labels[order.status]||order.status}</span></div>
      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Delivery destination</p><p className="mt-2 text-sm font-bold">{address?.recipient_name||"Customer"}</p><p className="mt-1 text-sm text-slate-600">{address?.address_line||"Address unavailable"}</p><p className="mt-1 text-xs text-slate-500">{address?.recipient_phone||""}{address?.landmark?" · Near "+address.landmark:""}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Order details</p><div className="mt-2 space-y-1">{(order.order_items??[]).map((item:{id:string;product_name:string;quantity:number;line_total:number})=><p key={item.id} className="flex justify-between gap-2 text-xs text-slate-600"><span>{item.quantity} × {item.product_name}</span><strong>{money(item.line_total)}</strong></p>)}</div><p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">COD order total: <strong className="text-[#102e57]">{money(order.total)}</strong></p></div></div>
      <div className="mt-4 border-t border-slate-100 pt-4">
       {order.status==="accepted"||order.status==="preparing"?<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">You have this order. Waiting for the merchant to prepare it and mark it ready for pickup.</p> : order.status==="assigned"&&order.driver_assignment_status==="offered"?<div className="flex flex-wrap gap-2"><form action={respondToDriverAssignment}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="accept" value="false"/><FormSubmitButton pendingLabel="Declining…" className="rounded-full border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700">Decline offer</FormSubmitButton></form><form action={respondToDriverAssignment}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="accept" value="true"/><FormSubmitButton pendingLabel="Accepting…" className="rounded-full bg-[#102e57] px-4 py-2.5 text-sm font-bold text-white">Accept delivery</FormSubmitButton></form></div>
       :order.status==="ready_for_pickup"||order.status==="assigned"?<form action={updateDriverOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="picked_up"/><FormSubmitButton pendingLabel="Confirming pickup…" className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Confirm pickup</FormSubmitButton></form>
       :order.status==="picked_up"?<form action={updateDriverOrderStatus}><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="in_transit"/><FormSubmitButton pendingLabel="Updating…" className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Start delivery</FormSubmitButton></form>
       :<form action={updateDriverOrderStatus} encType="multipart/form-data" className="space-y-3"><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="next_status" value="delivered"/><label className="block text-xs font-bold text-slate-600">Proof of delivery photo (required)<input required type="file" name="delivery_proof" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"/></label><label className="block text-xs font-bold text-slate-600">Delivery note (optional)<input name="driver_note" maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Recipient, handoff details…"/></label><FormSubmitButton pendingLabel="Uploading proof…" className="rounded-full bg-[#ff8a00] px-5 py-3 text-sm font-black text-white">Complete delivery</FormSubmitButton></form>}
      </div>
     </article>}) : <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-10 text-center"><div className="text-4xl">🛵</div><h3 className="mt-3 font-black">No active deliveries</h3><p className="mt-1 text-sm text-slate-500">{driver.is_available?"You are online. New dispatch offers will appear here.":"Go online when you are ready to receive delivery assignments."}</p></div>}</div>
    </section>
    <section className="mt-8"><h2 className="text-xl font-black">Recent completed deliveries</h2><div className="mt-3 space-y-2">{completed.slice(0,10).map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4"><div><p className="text-sm font-bold">{o.order_number}</p><p className="mt-1 text-xs text-slate-500">{new Date(o.placed_at).toLocaleDateString("en-PH")}</p></div><span className="text-sm font-black text-emerald-700">{money(o.total)}</span></div>)}{!completed.length&&<p className="text-sm text-slate-500">Completed deliveries will appear here.</p>}</div></section>
   </>}
   <footer className="mt-10 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, among ihatod.</footer>
  </div>
 </main>;
}
