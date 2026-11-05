import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyAsDriver, submitDriverDocuments, signOut } from "@/app/dashboard/actions";
import DriverApplicationForm from "@/components/driver/DriverApplicationForm";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";

export default async function DriverApplyPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
 const params=await searchParams;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login?next=/driver/apply");
 const [{data:profile},{data:driver}]=await Promise.all([
  supabase.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
  supabase.from("driver_profiles").select("status,vehicle_type,vehicle_plate,id_storage_path").eq("user_id",user.id).maybeSingle()
 ]);
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]"><div className="mx-auto max-w-2xl">
 <header className="flex items-center justify-between"><Link href="/" className="text-sm font-black">SUGOMATE</Link><div className="flex items-center gap-3"><span className="text-sm text-slate-500">{profile?.display_name||"Account"}</span><form action={signOut}><SignOutSubmitButton className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold"/></form></div></header>
 <section className="mt-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-orange-600">Delivery partner onboarding</p><h1 className="mt-2 text-3xl font-black">Deliver with SUGOMATE.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Apply with your verified SUGOMATE account and serve customers in your community.</p>
 {(params.success==="submitted"||params.success==="documents")&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">{params.success==="documents"?"Your documents were submitted. SUGOMATE Operations will review your application.":"Your delivery partner application and ID were submitted for review."}</p>}
 {params.error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{params.error==="docs"?"Please attach all required photos (JPG, PNG or WEBP, maximum 5 MB each): your government ID, a selfie holding the ID, and your driver’s license for motorized vehicles.":params.error==="upload"?"We could not upload your photos. Check your connection and try again.":"We could not submit the application. Please select a vehicle type and try again."}</p>}
 {driver?<><div className="mt-6 rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">Your application</strong><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-800">{driver.status}</span></div><p className="mt-2 text-sm text-slate-500">{driver.vehicle_type}{driver.vehicle_plate?" · "+driver.vehicle_plate:""}</p><p className={`mt-2 text-xs font-semibold ${driver.id_storage_path?"text-emerald-700":"text-rose-600"}`}>{driver.id_storage_path?"✓ Identification submitted":"Identification is missing — please upload it below so we can review your application."}</p></div>{driver.status==="pending"&&!driver.id_storage_path&&<DriverApplicationForm action={submitDriverDocuments} mode="docs" fixedVehicle={driver.vehicle_type??""}/>}</>:<DriverApplicationForm action={applyAsDriver} mode="new"/>}
 <p className="mt-6 text-xs text-slate-400"><Link href="/dashboard" className="font-bold text-orange-600">Return to your account</Link></p></section></div></main>;
}