import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyAsMerchant, signOut } from "@/app/dashboard/actions";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";

export default async function MerchantApplyPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
 const params=await searchParams;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login?next=/merchant/apply");
 const [{data:profile},{data:members}]=await Promise.all([
  supabase.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
  supabase.from("merchant_members").select("merchant_id,merchants(name,status)").eq("user_id",user.id)
 ]);
 const stores=(members??[]).map(m=>({id:m.merchant_id,store:m.merchants as unknown as {name:string;status:string}|null})).filter(m=>m.store);
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]"><div className="mx-auto max-w-2xl">
 <header className="flex items-center justify-between"><Link href="/" className="text-sm font-black">SUGOMATE</Link><div className="flex items-center gap-3"><span className="text-sm text-slate-500">{profile?.display_name||"Account"}</span><form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold"/></form></div></header>
 <section className="mt-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-orange-600">Local business onboarding</p><h1 className="mt-2 text-3xl font-black">Bring your store to SUGOMATE.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Apply using your verified SUGOMATE account. Our operations team will review your store before it can receive orders.</p>
 {params.success==="submitted"&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">Your merchant application was submitted for review.</p>}
 {params.error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">We couldn't submit the application. Check your details or contact support.</p>}
 {stores.length>0?<div className="mt-6 space-y-3"><h2 className="font-extrabold">Your store applications</h2>{stores.map(({id,store})=><div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><strong className="text-sm">{store!.name}</strong><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{store!.status}</span></div>)}</div>:<form action={applyAsMerchant} className="mt-6 space-y-4"><label className="block text-sm font-bold">Business / store name<input required name="business_name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" placeholder="e.g. Juan's Store"/></label><label className="block text-sm font-bold">Store URL name<input required name="business_slug" minLength={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" placeholder="e.g. juans-store"/></label><button className="rounded-full bg-[#102e57] px-6 py-3 text-sm font-extrabold text-white">Submit merchant application</button></form>}
 <p className="mt-6 text-xs text-slate-400"><Link href="/dashboard" className="font-bold text-orange-600">Return to your account</Link></p></section></div></main>;
}