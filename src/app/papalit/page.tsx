import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShoppingBag, Camera } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import PortalSignOut from "@/components/PortalSignOut";
import { createServiceRequest } from "@/app/service-requests/actions";

const field="mt-2 w-full rounded-xl border border-orange-100 bg-white px-3 py-3 text-sm text-[#102e57] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100";
const money=(v:number|string)=>"₱"+Number(v).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});

export default async function PapalitPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const params=await searchParams;
 const {user,supabase}=await requireCustomer();
 const {data:addresses}=await supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,landmark,municipalities(name)").eq("customer_id",user.id).order("created_at",{ascending:false});
 const {data:requests}=await supabase.from("service_requests").select("id,request_number,status,request_title,quoted_total,created_at").eq("customer_id",user.id).eq("service_type","papalit").order("created_at",{ascending:false}).limit(5);
 const errors:Record<string,string>={details:"Complete the request details and enter a valid estimated budget.",items:"Add at least one item to your shopping list.",address:"Choose one of your saved delivery addresses.",image:"Reference photo must be JPG, PNG or WEBP and no larger than 5 MB.",save:"We could not submit your request. Please try again."};
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8"><div className="mx-auto max-w-3xl">
  <header className="flex items-center justify-between gap-3"><Link href="/customer" className="flex items-center gap-2 text-sm font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-white">S</span>SUGOMATE</Link><PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold"/></header>
  <Link href="/customer" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-orange-700"><ArrowLeft size={14}/>Marketplace</Link>
  <section className="mt-4 rounded-3xl bg-gradient-to-br from-[#102e57] to-[#1b4779] p-6 text-white"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><ShoppingBag size={25}/></span><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-200">SUGOMATE personal shopping</p><h1 className="text-2xl font-black">Papalit</h1></div></div><p className="mt-3 max-w-xl text-sm leading-6 text-white/80">You tell us what to buy. A SUGOMATE rider purchases your requested items and delivers them to your door.</p></section>
  <div className="mt-4 flex gap-2 text-xs font-bold"><Link href="/papalit" className="rounded-full bg-[#102e57] px-4 py-2 text-white">Papalit</Link><Link href="/pasugo" className="rounded-full border border-orange-200 bg-white px-4 py-2 text-[#102e57]">Pasugo</Link><Link href="/customer/service-requests" className="ml-auto rounded-full border border-orange-200 bg-white px-4 py-2 text-[#102e57]">My requests</Link></div>
  {params.error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{errors[params.error]??"Please check your request and try again."}</p>}
  <form action={createServiceRequest} encType="multipart/form-data" className="mt-5 space-y-4 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-7">
   <input type="hidden" name="service_type" value="papalit"/>
   <div><h2 className="text-lg font-black">What would you like us to buy?</h2><p className="mt-1 text-xs text-slate-500">List every item, quantity and any preferred brand or size.</p></div>
   <label className="block text-xs font-bold text-slate-600">Request title<input name="request_title" required minLength={2} maxLength={140} placeholder="e.g. Grocery shopping" className={field}/></label>
   <label className="block text-xs font-bold text-slate-600">Shopping list<textarea name="items" required rows={5} maxLength={3000} placeholder={"Example:\n2 x 1L fresh milk\n1 x loaf of wheat bread\n3 x canned tuna"} className={field}/><span className="mt-1 block text-[10px] font-medium text-slate-400">One item per line. You can write quantities like “2 x item”. Up to 30 items.</span></label>
   <label className="block text-xs font-bold text-slate-600">Instructions / preferred brands<textarea name="instructions" rows={3} maxLength={1000} placeholder="Brand, size, acceptable alternatives, preferred shop…" className={field}/></label>
   <label className="block text-xs font-bold text-slate-600">Reference photo (optional)<span className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-orange-200 bg-orange-50 p-3 text-xs text-slate-500"><Camera size={18}/> <input type="file" name="reference_image" accept="image/jpeg,image/png,image/webp" className="min-w-0 flex-1 text-xs"/></span><span className="mt-1 block text-[10px] text-slate-400">JPG, PNG or WEBP · Maximum 5 MB</span></label>
   <label className="block text-xs font-bold text-slate-600">Maximum shopping budget (₱)<input name="customer_budget" type="number" min="1" max="50000" step="0.01" placeholder="e.g. 1000" className={field}/><span className="mt-1 block text-[10px] text-slate-400">This is a spending limit, not the final charge. Admin will confirm the estimate before payment.</span></label>
   <label className="block text-xs font-bold text-slate-600">Deliver to<select name="address_id" required defaultValue="" className={field}><option value="" disabled>Select saved delivery address</option>{(addresses??[]).map(a=><option key={a.id} value={a.id}>{a.label} · {a.address_line} · {Array.isArray(a.municipalities)?a.municipalities[0]?.name:a.municipalities?.name}</option>)}</select></label>
   {!(addresses??[]).length&&<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Add a delivery address before submitting. <Link className="font-black underline" href="/customer/addresses">Manage addresses</Link></p>}
   <div className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900">Your request is reviewed first. We will confirm the item estimate, service fee and delivery fee before asking you to pay. The rider will not purchase anything before payment is confirmed.</div>
   <button disabled={!(addresses??[]).length} className="w-full rounded-full bg-[#ff8a00] px-5 py-3.5 text-sm font-black text-white shadow-md shadow-orange-100 disabled:opacity-40">Submit Papalit request</button>
  </form>
  {(requests??[]).length>0&&<section className="mt-7"><h2 className="font-black">Recent Papalit requests</h2><div className="mt-3 space-y-2">{requests!.map(r=><Link key={r.id} href="/customer/service-requests" className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white p-4"><span><b className="block text-sm">{r.request_title}</b><span className="text-[10px] text-slate-400">{r.request_number} · {new Date(r.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</span></span><span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-bold capitalize text-orange-800">{r.status.replaceAll("_"," ")}</span></Link>)}</div></section>}
 </div></main>;
}
