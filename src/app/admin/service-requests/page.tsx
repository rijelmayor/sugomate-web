import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalSignOut from "@/components/PortalSignOut";
import FormSubmitButton from "@/components/FormSubmitButton";
import { approveAndDispatchServiceRequest } from "./actions";

const money=(v:number|string|null)=>"₱"+Number(v??0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});

export default async function AdminServiceRequestsPage({searchParams}:{searchParams:Promise<{error?:string;updated?:string}>}) {
 const params=await searchParams;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const {data:admin}=await supabase.from("user_roles").select("role").eq("user_id",user.id).eq("role","admin").maybeSingle();
 if(!admin) redirect("/dashboard?error=admin-access");
 const [requestsQ,driversQ]=await Promise.all([
  supabase.from("service_requests").select("id,request_number,service_type,status,request_title,instructions,items,purchase_required,pickup_location,pickup_contact_name,pickup_contact_phone,delivery_address_snapshot,municipality_id,customer_budget,created_at,reference_image_path").eq("status","pending_review").order("created_at",{ascending:true}).limit(100),
  supabase.from("driver_profiles").select("user_id,vehicle_type,vehicle_plate,municipality_id").eq("status","active").eq("is_available",true).order("last_seen_at",{ascending:false})
 ]);
 const requests=requestsQ.data??[], drivers=driversQ.data??[];
 const ids=[...new Set(drivers.map(d=>d.user_id))];
 const {data:profiles}=ids.length?await supabase.from("profiles").select("id,display_name,phone").in("id",ids):{data:[]};
 const profileMap=new Map((profiles??[]).map(p=>[p.id,p]));
 const municipalities=[...new Set(requests.map(r=>r.municipality_id).filter(Boolean))] as string[];
 const {data:authorizations}=ids.length&&municipalities.length?await supabase.from("rider_locality_authorizations").select("rider_user_id,municipality_id").in("rider_user_id",ids).in("municipality_id",municipalities).is("revoked_at",null).lte("starts_at",new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`):{data:[]};
 const eligible=(request:any)=>drivers.filter(d=>d.municipality_id===request.municipality_id||(authorizations??[]).some(a=>a.rider_user_id===d.user_id&&a.municipality_id===request.municipality_id));
 return <main className="min-h-screen bg-[#f3f5f9] px-4 py-6 text-[#172b45] sm:px-7 sm:py-8"><div className="mx-auto max-w-6xl">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin" className="text-sm font-black text-orange-600">← SUGOMATE Operations</Link><p className="mt-3 text-[10px] font-black uppercase tracking-[.2em] text-orange-600">Special services</p><h1 className="mt-1 text-3xl font-black">Papalit & Pasugo review</h1><p className="mt-2 text-sm text-slate-500">Review customer requests, confirm the budget and fees, then dispatch an eligible online rider.</p></div><div className="flex gap-2"><Link href="/admin/dispatch" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Regular dispatch</Link><PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold"/></div></header>
  {params.updated&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Request approved and assigned. It is now visible in the rider&apos;s incoming service requests.</p>}
  {params.error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{params.error==="details"?"Check the selected rider and all budget and fee fields.":"Could not approve or dispatch this request. Confirm the rider is online, eligible for the locality and not already handling a special request."}</p>}
  <section className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">Awaiting review</p><p className="mt-1 text-3xl font-black">{requests.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">Online approved riders</p><p className="mt-1 text-3xl font-black">{drivers.length}</p></div></section>
  <section className="mt-7 space-y-4">{requests.length?requests.map(r=>{const address=r.delivery_address_snapshot as {recipient_name?:string;recipient_phone?:string;address_line?:string;landmark?:string;municipality?:string}|null;const items=Array.isArray(r.items)?r.items as {name?:string;quantity?:number}[]:[];const options=eligible(r);return <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${r.service_type==="papalit"?"bg-orange-100 text-orange-800":"bg-blue-100 text-blue-800"}`}>{r.service_type}</span><h2 className="mt-2 text-xl font-black">{r.request_title}</h2><p className="mt-1 text-xs text-slate-400">{r.request_number} · {new Date(r.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Pending review</span></div>
   <div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Requested items</h3><div className="mt-2 space-y-1 rounded-xl bg-orange-50 p-3">{items.map((it,i)=><p key={i} className="text-sm">{it.quantity??1} × {it.name}</p>)}</div><p className="mt-3 text-xs text-slate-600">{r.instructions||"No additional instructions."}</p>{r.pickup_location&&<p className="mt-2 text-xs text-slate-600"><b>Pickup:</b> {r.pickup_location}{r.pickup_contact_name? ` · ${r.pickup_contact_name}`:""}{r.pickup_contact_phone? ` · ${r.pickup_contact_phone}`:""}</p>}</div><div><h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Delivery details</h3><p className="mt-2 text-sm font-bold">{address?.recipient_name||"Customer"}</p><p className="text-sm text-slate-600">{address?.address_line||"Address unavailable"}</p><p className="text-xs text-slate-500">{address?.landmark||""} · {address?.municipality||"Locality not listed"}</p><p className="mt-3 text-sm">Customer budget: <b>{r.customer_budget===null?"Not specified":money(r.customer_budget)}</b></p></div></div>
   <form action={approveAndDispatchServiceRequest} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><input type="hidden" name="request_id" value={r.id}/><div className="sm:col-span-2"><h3 className="font-black">Confirm charges & assign rider</h3><p className="mt-1 text-xs text-slate-500">The customer pays the rider directly at delivery. The quoted total is the expected collection, not an online checkout.</p></div>
    <label className="text-xs font-bold text-slate-600">Approved purchase budget (₱)<input required type="number" name="approved_purchase_budget" min="0" max="50000" step="0.01" defaultValue={r.purchase_required?(r.customer_budget??""):"0"} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/></label>
    <label className="text-xs font-bold text-slate-600">Delivery fee (₱)<input required type="number" name="delivery_fee" min="0" max="50000" step="0.01" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/></label>
    <label className="text-xs font-bold text-slate-600">Service fee (₱)<input required type="number" name="service_fee" min="0" max="50000" step="0.01" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/></label>
    <label className="text-xs font-bold text-slate-600">Eligible online rider<select required name="driver_user_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>{options.length?"Select rider":"No eligible online rider"}</option>{options.map(d=><option key={d.user_id} value={d.user_id}>{profileMap.get(d.user_id)?.display_name||"Delivery partner"} · {d.vehicle_type}{d.vehicle_plate?` · ${d.vehicle_plate}`:""}</option>)}</select></label>
    <div className="sm:col-span-2"><FormSubmitButton disabled={!options.length} pendingLabel="Approving & dispatching…" className="w-full rounded-xl bg-[#102e57] px-5 py-3 text-sm font-black text-white disabled:opacity-40">Approve & send to rider</FormSubmitButton></div>
   </form>
  </article>}):<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-lg font-black">No requests awaiting review</h2><p className="mt-2 text-sm text-slate-500">New Papalit and Pasugo submissions will appear here.</p></div>}</section>
 </div></main>;
}
