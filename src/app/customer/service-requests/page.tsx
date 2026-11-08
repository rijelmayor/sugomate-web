import Link from "next/link";
import { ArrowLeft, ShoppingBag, PackageCheck } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import PortalSignOut from "@/components/PortalSignOut";

const money=(v:number|string|null)=>"₱"+Number(v??0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const labels:Record<string,string>={pending_review:"Under review",quoted:"Estimate ready",awaiting_payment:"Awaiting payment",paid:"Paid · awaiting rider",assigned:"Rider assigned",shopping:"Rider shopping",purchased:"Purchased",picked_up:"Picked up",in_transit:"On the way",delivered:"Delivered",cancelled:"Cancelled"};

export default async function CustomerServiceRequests({searchParams}:{searchParams:Promise<{submitted?:string}>}){
 const params=await searchParams;
 const {user,supabase}=await requireCustomer();
 const {data:requests}=await supabase.from("service_requests").select("id,request_number,service_type,status,request_title,items,delivery_address_snapshot,pickup_location,customer_budget,approved_purchase_budget,actual_purchase_amount,delivery_fee,service_fee,quoted_total,payment_status,payment_method,amount_collected,collected_at,created_at,updated_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(100);
 const ids=(requests??[]).map(r=>r.id);
 const {data:events}=ids.length?await supabase.from("service_request_events").select("id,service_request_id,event_type,note,created_at").in("service_request_id",ids).order("created_at",{ascending:true}):{data:[]};
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8"><div className="mx-auto max-w-3xl">
  <header className="flex items-center justify-between gap-3"><Link href="/customer" className="flex items-center gap-2 text-sm font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-white">S</span>SUGOMATE</Link><PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold"/></header>
  <Link href="/customer" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-orange-700"><ArrowLeft size={14}/>Marketplace</Link>
  <h1 className="mt-4 text-3xl font-black">My Pabili & Pasugo</h1><p className="mt-2 text-sm text-slate-500">Your shopping and pickup requests are tracked separately from merchant orders.</p>
  {params.submitted&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Your request has been submitted. SUGOMATE Admin will review it and prepare an estimate.</p>}
  <div className="mt-5 flex gap-2"><Link href="/papalit" className="inline-flex items-center gap-2 rounded-full bg-[#102e57] px-4 py-2.5 text-xs font-black text-white"><ShoppingBag size={15}/>New Papalit</Link><Link href="/pasugo" className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2.5 text-xs font-black"><PackageCheck size={15}/>New Pasugo</Link></div>
  <div className="mt-6 space-y-4">{(requests??[]).length?(requests??[]).map(r=>{
   const address=r.delivery_address_snapshot as {address_line?:string;municipality?:string}|null;
   const items=Array.isArray(r.items)?r.items as {name?:string;quantity?:number}[]:[];
   const history=(events??[]).filter(e=>e.service_request_id===r.id);
   return <article key={r.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${r.service_type==="papalit"?"bg-orange-100 text-orange-800":"bg-blue-100 text-blue-800"}`}>{r.service_type}</span><h2 className="mt-2 text-lg font-black">{r.request_title}</h2><p className="mt-1 text-[10px] text-slate-400">{r.request_number} · {new Date(r.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700">{labels[r.status]??r.status}</span></div>
    {r.pickup_location&&<p className="mt-3 text-xs text-slate-600"><b>Pickup:</b> {r.pickup_location}</p>}
    <p className="mt-2 text-xs text-slate-600"><b>Deliver to:</b> {address?.address_line??"Saved address"}</p>
    <div className="mt-3 space-y-1 rounded-xl bg-orange-50 p-3">{items.map((item,i)=><p key={i} className="text-xs text-slate-700">{item.quantity??1} × {item.name}</p>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">{[[ "Customer budget",r.customer_budget ],["Approved purchase budget",r.approved_purchase_budget],["Actual purchase",r.actual_purchase_amount],["Delivery fee",r.delivery_fee],["Service fee",r.service_fee],["Quoted total",r.quoted_total]].map(([label,value])=><div key={String(label)} className="rounded-lg border border-slate-100 p-2"><span className="block text-[10px] text-slate-400">{label}</span><b>{value===null? "To be confirmed":money(value as number|string)}</b></div>)}</div>
    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"><p>Payment: <b className="capitalize">{r.payment_status}</b></p>{r.payment_status==="paid"&&<p className="mt-1">Paid directly to rider: <b>{money(r.amount_collected)}</b> · <b className="uppercase">{r.payment_method}</b>{r.collected_at&&<span className="block text-[10px] text-slate-400">{new Date(r.collected_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</span>}</p>}{r.payment_status!=="paid"&&<p className="mt-1 text-slate-500">Pay your assigned rider directly in cash or GCash when your request is delivered.</p>}</div>
    {history.length>0&&<details className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-bold text-slate-500">Request activity ({history.length})</summary><ol className="mt-2 space-y-2">{history.map(e=><li key={e.id} className="text-xs"><b className="capitalize">{e.event_type.replaceAll("_"," ")}</b>{e.note&&<span className="text-slate-500"> · {e.note}</span>}<span className="block text-[10px] text-slate-400">{new Date(e.created_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</span></li>)}</ol></details>}
   </article>;
  }):<div className="rounded-3xl border border-dashed border-orange-200 bg-white p-10 text-center"><h2 className="text-lg font-black">No requests yet</h2><p className="mt-2 text-sm text-slate-500">Your Papalit and Pasugo requests will appear here.</p></div>}</div>
 </div></main>;
}
