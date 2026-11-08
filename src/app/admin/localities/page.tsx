import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalSignOut from "@/components/PortalSignOut";
import FormSubmitButton from "@/components/FormSubmitButton";
import { saveDeliveryRoute, authorizeRiderLocality, revokeRiderLocality } from "../actions";
const money=(v:number|string)=>"₱"+Number(v).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function AdminLocalitiesPage({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}) {
 const params=await searchParams; const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const {data:admin}=await supabase.from("user_roles").select("role").eq("user_id",user.id).eq("role","admin").maybeSingle();
 if(!admin) redirect("/dashboard?error=admin-access");
 const [{data:municipalities},{data:routes},{data:drivers},{data:grants},{data:audit}]=await Promise.all([
  supabase.from("municipalities").select("id,name,province,is_serviceable").order("name"),
  supabase.from("delivery_routes").select("id,origin_municipality_id,destination_municipality_id,delivery_fee,is_active,notes").order("origin_municipality_id"),
  supabase.from("driver_profiles").select("user_id,status,municipality_id,vehicle_type").order("created_at",{ascending:false}),
  supabase.from("rider_locality_authorizations").select("id,rider_user_id,municipality_id,reason,starts_at,expires_at,revoked_at").is("revoked_at",null).order("created_at",{ascending:false}),
  supabase.from("rider_locality_authorization_audit").select("rider_user_id,municipality_id,action,reason,actor_id,occurred_at").order("occurred_at",{ascending:false}).limit(30)
 ]);
 const riderIds=[...new Set([...(drivers??[]).map(d=>d.user_id),...(grants??[]).map(g=>g.rider_user_id)])];
 const {data:profiles}=riderIds.length?await supabase.from("profiles").select("id,display_name,phone").in("id",riderIds):{data:[]};
 const profileMap=new Map((profiles??[]).map(p=>[p.id,p]));
 const municipalityMap=new Map((municipalities??[]).map(m=>[m.id,m]));
 const activeDrivers=(drivers??[]).filter(d=>d.status==="active");
 return <main className="min-h-screen bg-[#f3f5f9] px-4 py-7 text-[#172b45] sm:px-7"><div className="mx-auto max-w-6xl">
 <header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin" className="text-sm font-black text-orange-600">← SUGOMATE Operations</Link><p className="mt-3 text-[10px] font-black uppercase tracking-[.2em] text-orange-600">Service geography</p><h1 className="mt-1 text-3xl font-black">Localities & dispatch rules</h1><p className="mt-2 text-sm text-slate-500">Configure route pricing and temporary rider pickup authorizations.</p></div><PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold"/></header>
 {params.error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">We could not save that change. Check the locality, fee, expiry and reason.</p>}
 {params.saved&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Locality settings saved.</p>}
 <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">Delivery route pricing</h2><p className="mt-1 text-sm text-slate-500">Checkout requires an active route from the selected branch municipality to the delivery address municipality. Existing same-locality fees are retained.</p>
 <form action={saveDeliveryRoute} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
 <label className="text-xs font-bold">Pickup municipality<select required name="origin_municipality_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Select origin</option>{(municipalities??[]).filter(m=>m.is_serviceable).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 <label className="text-xs font-bold">Delivery municipality<select required name="destination_municipality_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Select destination</option>{(municipalities??[]).filter(m=>m.is_serviceable).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 <label className="text-xs font-bold">Delivery fee (₱)<input required name="delivery_fee" type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
 <label className="text-xs font-bold">Admin note<input name="notes" maxLength={500} placeholder="Optional" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
 <div className="flex items-center gap-2"><input id="route-active" name="is_active" type="checkbox" defaultChecked className="h-4 w-4"/><label htmlFor="route-active" className="text-xs font-bold">Activate</label><FormSubmitButton className="ml-auto rounded-full bg-[#102b4e] px-4 py-3 text-xs font-extrabold text-white">Save route</FormSubmitButton></div>
 </form>
 <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-400"><th className="py-3">Pickup</th><th>Destination</th><th>Fee</th><th>Status</th><th>Notes</th></tr></thead><tbody>{(routes??[]).map(r=><tr key={r.id} className="border-b border-slate-100"><td className="py-3 font-bold">{municipalityMap.get(r.origin_municipality_id)?.name??"—"}</td><td>{municipalityMap.get(r.destination_municipality_id)?.name??"—"}</td><td>{money(r.delivery_fee)}</td><td><span className={r.is_active?"text-emerald-700":"text-slate-400"}>{r.is_active?"Active":"Inactive"}</span></td><td className="text-xs text-slate-500">{r.notes??"—"}</td></tr>)}</tbody></table></div></section>
 <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">Additional rider pickup localities</h2><p className="mt-1 text-sm text-slate-500">Registered locality remains the rider’s default. Additional localities require an Admin reason and may expire automatically.</p>
 <form action={authorizeRiderLocality} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <label className="text-xs font-bold">Active rider<select required name="rider_user_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Select rider</option>{activeDrivers.map(d=><option key={d.user_id} value={d.user_id}>{profileMap.get(d.user_id)?.display_name??d.user_id} · {municipalityMap.get(d.municipality_id)?.name??"Locality not set"}</option>)}</select></label>
 <label className="text-xs font-bold">Additional pickup locality<select required name="municipality_id" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Select locality</option>{(municipalities??[]).filter(m=>m.is_serviceable).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 <label className="text-xs font-bold">Expiry (optional)<input name="expires_at" type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
 <label className="text-xs font-bold">Reason (required)<input required minLength={3} name="reason" placeholder="Emergency coverage, peak demand…" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
 <div className="sm:col-span-2 lg:col-span-4"><FormSubmitButton className="rounded-full bg-[#102b4e] px-5 py-3 text-sm font-extrabold text-white">Authorize additional locality</FormSubmitButton></div></form>
 <div className="mt-6 space-y-3">{(grants??[]).map(g=><article key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div><p className="text-sm font-black">{profileMap.get(g.rider_user_id)?.display_name??g.rider_user_id} · {municipalityMap.get(g.municipality_id)?.name??"Unknown locality"}</p><p className="mt-1 text-xs text-slate-500">{g.reason} · {g.expires_at?"Expires "+new Date(g.expires_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"}):"No expiry"}</p></div><form action={revokeRiderLocality} className="flex flex-wrap gap-2"><input type="hidden" name="authorization_id" value={g.id}/><input required name="reason" minLength={3} placeholder="Revocation reason" className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-xs"/><button className="rounded-full border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Revoke</button></form></article>)}</div></section>
 <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black">Authorization audit trail</h2><div className="mt-3 space-y-2">{(audit??[]).map((a,i)=><p key={i} className="border-b border-slate-100 py-2 text-xs text-slate-600"><strong>{a.action}</strong> · {profileMap.get(a.rider_user_id)?.display_name??a.rider_user_id} · {municipalityMap.get(a.municipality_id)?.name??"—"} · {a.reason??"—"} · {new Date(a.occurred_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</p>)}</div></section>
 </div></main>;
}
