import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyAsMerchant, signOut } from "@/app/dashboard/actions";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import FormSubmitButton from "@/components/FormSubmitButton";

export default async function MerchantApplyPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
 const params=await searchParams;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login?next=/merchant/apply");
 const [{data:profile},{data:members},{data:municipalities}]=await Promise.all([
  supabase.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
  supabase.from("merchant_members").select("merchant_id,merchants(name,status)").eq("user_id",user.id),
  supabase.from("municipalities").select("id,name,province").eq("is_serviceable",true).order("name")
 ]);
 const stores=(members??[]).map(m=>({id:m.merchant_id,store:m.merchants as unknown as {name:string;status:string}|null})).filter(m=>m.store);
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]"><div className="mx-auto max-w-2xl">
 <header className="flex items-center justify-between"><Link href="/" className="text-sm font-black">SUGOMATE</Link><div className="flex items-center gap-3"><span className="text-sm text-slate-500">{profile?.display_name||"Account"}</span><form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold"/></form></div></header>
 <section className="mt-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-orange-600">Local business onboarding</p><h1 className="mt-2 text-3xl font-black">Bring your store to SUGOMATE.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Thank you for choosing to register as a SUGOMATE merchant. Complete your store details below so customers can discover your business. Our Admin team will review your application before your store can receive orders.</p>
 {params.success==="submitted"&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">Your merchant application was submitted for review.</p>}
 {params.error && stores.length === 0 && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">We could not submit the application. Check your details or contact support.</p>}
 {stores.length > 0 && stores.some(({store}) => store?.status === "pending") && params.success !== "submitted" && <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">Your store application is on file and awaiting review. You do not need to submit it again.</p>}
 {stores.length>0?<div className="mt-6 space-y-3"><h2 className="font-extrabold">Your store applications</h2>{stores.map(({id,store})=><div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><strong className="text-sm">{store!.name}</strong><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{store!.status}</span></div>)}</div>:<form action={applyAsMerchant} className="mt-6 space-y-4">
<label className="block text-sm font-bold">Business / store name<input required name="business_name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" placeholder="e.g. Juan Store"/></label>
<label className="block text-sm font-bold">Store URL name<input required name="business_slug" minLength={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" placeholder="e.g. juans-store"/></label>
<label className="block text-sm font-bold">Business municipality<select required name="municipality_id" defaultValue="" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"><option value="" disabled>Select where the store is physically located</option>{(municipalities??[]).map(m=><option key={m.id} value={m.id}>{m.name}, {m.province}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">This is the pickup locality for this branch, not the owner’s home address.</span></label>
<label className="block text-sm font-bold">Store address<textarea required name="business_address" rows={2} placeholder="Street, barangay, municipality" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
<label className="block text-sm font-bold">Contact phone <span className="font-normal text-slate-400">(optional)</span><input name="business_phone" type="tel" placeholder="09XXXXXXXXX" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
<label className="block text-sm font-bold">Short description <span className="font-normal text-slate-400">(optional)</span><textarea name="business_description" rows={3} placeholder="What do you sell?" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
<FormSubmitButton pendingLabel="Submitting application…" className="w-full rounded-full bg-[#102e57] px-6 py-3 text-sm font-extrabold text-white sm:w-auto">Submit merchant application</FormSubmitButton>
</form>}
 <p className="mt-6 text-xs text-slate-400"><Link href="/dashboard" className="font-bold text-orange-600">Return to your account</Link></p></section></div></main>;
}