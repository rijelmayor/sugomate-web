import Link from "next/link";
import { ArrowLeft, PackageCheck, Camera } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import PortalSignOut from "@/components/PortalSignOut";
import { createServiceRequest } from "@/app/service-requests/actions";

const field="mt-2 w-full rounded-xl border border-orange-100 bg-white px-3 py-3 text-sm text-[#102e57] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

export default async function PasugoPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const params=await searchParams;
 const {user,supabase}=await requireCustomer();
 const {data:addresses}=await supabase.from("customer_addresses").select("id,label,address_line,municipalities(name)").eq("customer_id",user.id).order("created_at",{ascending:false});
 const {data:requests}=await supabase.from("service_requests").select("id,request_number,status,request_title,created_at").eq("customer_id",user.id).eq("service_type","pasugo").order("created_at",{ascending:false}).limit(5);
 const errors:Record<string,string>={details:"Complete the request details and enter a valid budget.",items:"Describe the item or items to be collected.",address:"Choose one of your saved delivery addresses.",pickup:"Enter the shop or pickup location.",image:"Reference photo must be JPG, PNG or WEBP and no larger than 5 MB.",save:"We could not submit your request. Please try again."};
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8"><div className="mx-auto max-w-3xl">
  <header className="flex items-center justify-between gap-3"><Link href="/customer" className="flex items-center gap-2 text-sm font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-white">S</span>SUGOMATE</Link><PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold"/></header>
  <Link href="/customer" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-orange-700"><ArrowLeft size={14}/>Marketplace</Link>
  <section className="mt-4 rounded-3xl bg-gradient-to-br from-[#102e57] to-[#1b4779] p-6 text-white"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><PackageCheck size={25}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-200">SUGOMATE pickup service</p><h1 className="text-2xl font-black">Pasugo</h1></div></div><p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Need something bought or picked up from a specific place? Tell us where it is and where it should go.</p></section>
  <div className="mt-4 flex gap-2 text-xs font-bold"><Link href="/papalit" className="rounded-full border border-orange-200 bg-white px-4 py-2 text-[#102e57]">Papalit</Link><Link href="/pasugo" className="rounded-full bg-[#102e57] px-4 py-2 text-white">Pasugo</Link><Link href="/customer/service-requests" className="ml-auto rounded-full border border-orange-200 bg-white px-4 py-2 text-[#102e57]">My requests</Link></div>
  {params.error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{errors[params.error]??"Please check your request and try again."}</p>}
  <form action={createServiceRequest} encType="multipart/form-data" className="mt-5 space-y-4 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-7">
   <input type="hidden" name="service_type" value="pasugo"/>
   <div><h2 className="text-lg font-black">What should the rider buy or pick up?</h2><p className="mt-1 text-xs text-slate-500">First release supports purchases and item/package pickups only.</p></div>
   <label className="block text-xs font-bold text-slate-600">Request title<input name="request_title" required minLength={2} maxLength={140} placeholder="e.g. Pick up my parcel" className={field}/></label>
   <label className="block text-xs font-bold text-slate-600">Request type<select name="purchase_required" className={field}><option value="false">Pick up an item already paid for</option><option value="true">Buy an item and bring it to me</option></select></label>
   <label className="block text-xs font-bold text-slate-600">Item / package details<textarea name="items" required rows={4} maxLength={3000} placeholder="Describe the item, quantity, size, identifying details or package reference…" className={field}/></label>
   <label className="block text-xs font-bold text-slate-600">Pickup location<input name="pickup_location" required minLength={3} maxLength={300} placeholder="Store name, address or pickup point" className={field}/></label>
   <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-600">Pickup contact name (optional)<input name="pickup_contact_name" maxLength={120} className={field}/></label><label className="block text-xs font-bold text-slate-600">Pickup contact phone (optional)<input name="pickup_contact_phone" maxLength={40} className={field}/></label></div>
   <label className="block text-xs font-bold text-slate-600">Instructions<textarea name="instructions" rows={3} maxLength={1000} placeholder="Pickup code, contact instructions, preferred brand or size…" className={field}/></label>
   <label className="block text-xs font-bold text-slate-600">Reference photo (optional)<span className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-orange-200 bg-orange-50 p-3 text-xs text-slate-500"><Camera size={18}/><input type="file" name="reference_image" accept="image/jpeg,image/png,image/webp" className="min-w-0 flex-1 text-xs"/></span><span className="mt-1 block text-[10px] text-slate-400">JPG, PNG or WEBP · Maximum 5 MB</span></label>
   <label className="block text-xs font-bold text-slate-600">Maximum purchase budget (₱)<input name="customer_budget" type="number" min="1" max="50000" step="0.01" placeholder="Required if the rider must buy the item" className={field}/></label>
   <label className="block text-xs font-bold text-slate-600">Deliver to<select name="address_id" required defaultValue="" className={field}><option value="" disabled>Select saved delivery address</option>{(addresses??[]).map(a=><option key={a.id} value={a.id}>{a.label} · {a.address_line}</option>)}</select></label>
   {!(addresses??[]).length&&<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Add a delivery address first. <Link className="font-black underline" href="/customer/addresses">Manage addresses</Link></p>}
   <div className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900">Pasugo is limited to item purchases and pickups. No bill payments or unrelated errands in this release. Admin confirms charges before payment and dispatch.</div>
   <button disabled={!(addresses??[]).length} className="w-full rounded-full bg-[#ff8a00] px-5 py-3.5 text-sm font-black text-white shadow-md shadow-orange-100 disabled:opacity-40">Submit Pasugo request</button>
  </form>
  {(requests??[]).length>0&&<section className="mt-7"><h2 className="font-black">Recent Pasugo requests</h2><div className="mt-3 space-y-2">{requests!.map(r=><Link key={r.id} href="/customer/service-requests" className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white p-4"><span><b className="block text-sm">{r.request_title}</b><span className="text-[10px] text-slate-400">{r.request_number} · {new Date(r.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</span></span><span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-bold capitalize text-orange-800">{r.status.replaceAll("_"," ")}</span></Link>)}</div></section>}
 </div></main>;
}
