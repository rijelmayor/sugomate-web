import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyAsDriver, signOut } from "@/app/dashboard/actions";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";

export default async function DriverApplyPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
 const params=await searchParams;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login?next=/driver/apply");
 const [{data:profile},{data:driver}]=await Promise.all([
  supabase.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
  supabase.from("driver_profiles").select("status,vehicle_type,vehicle_plate").eq("user_id",user.id).maybeSingle()
 ]);
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]"><div className="mx-auto max-w-2xl">
 <header className="flex items-center justify-between"><Link href="/" className="text-sm font-black">SUGOMATE</Link><div className="flex items-center gap-3"><span className="text-sm text-slate-500">{profile?.display_name||"Account"}</span><form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold"/></form></div></header>
 <section className="mt-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-orange-600">Delivery partner onboarding</p><h1 className="mt-2 text-3xl font-black">Deliver with SUGOMATE.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Apply with your verified SUGOMATE account and serve customers in your community.</p>
 {params.success==="submitted"&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">Your delivery partner application was submitted for review.</p>}
 {params.error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">We couldn't submit the application. Please select a vehicle type and try again.</p>}
 {driver?<div className="mt-6 rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">Your application</strong><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{driver.status}</span></div><p className="mt-2 text-sm text-slate-500">{driver.vehicle_type}{driver.vehicle_plate?" · "+driver.vehicle_plate:""}</p></div>:<form action={applyAsDriver} className="mt-6 space-y-4"><label className="block text-sm font-bold">Vehicle type<select required name="vehicle_type" defaultValue="" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"><option value="" disabled>Select your vehicle</option><option>Motorcycle</option><option>Bicycle</option><option>Car</option><option>Other</option></select></label><label className="block text-sm font-bold">Plate number <span className="font-normal text-slate-400">(optional)</span><input name="vehicle_plate" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" placeholder="Vehicle plate number"/></label><button className="rounded-full bg-[#102e57] px-6 py-3 text-sm font-extrabold text-white">Submit delivery partner application</button></form>}
 <p className="mt-6 text-xs text-slate-400"><Link href="/dashboard" className="font-bold text-orange-600">Return to your account</Link></p></section></div></main>;
}