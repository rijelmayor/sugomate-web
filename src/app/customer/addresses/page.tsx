import { requireCustomer } from "@/lib/auth";
import PendingLink from "@/components/PendingLink";
import { saveCustomerAddress } from "@/app/customer/actions";
import FormSubmitButton from "@/components/FormSubmitButton";
import PortalSignOut from "@/components/PortalSignOut";

export default async function CustomerAddresses({ searchParams }: { searchParams: Promise<{error?:string;saved?:string}> }) {
  const params=await searchParams;
  const {user,supabase}=await requireCustomer();
  const [{data:addresses},{data:municipalities},{data:serviceZones}]=await Promise.all([
    supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,landmark,service_zone_id,service_zones(name),municipalities(name)").eq("customer_id",user.id).order("created_at",{ascending:false}),
    supabase.from("municipalities").select("id,name").eq("is_serviceable",true).order("name"),
    supabase.from("service_zones").select("id,name,municipality_id").eq("is_active",true).order("name")
  ]);
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]"><div className="mx-auto max-w-2xl">
    <div className="flex items-center justify-between gap-3"><PendingLink href="/customer" className="text-sm font-bold text-orange-600">← Back to marketplace</PendingLink><PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold"/></div>
    <h1 className="mt-5 text-3xl font-black">Delivery addresses</h1><p className="mt-2 text-sm text-slate-500">Save where SUGOMATE should deliver your orders.</p>
    {params.saved&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Address saved successfully.</p>}
    {params.error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Please complete the required fields and try again.</p>}
    <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-6"><h2 className="text-lg font-black">Add a new address</h2>
      <form action={saveCustomerAddress} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="label" placeholder="Label (Home, Work)" defaultValue="Home" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
        <input name="recipient_name" required placeholder="Recipient full name" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
        <input name="recipient_phone" required placeholder="Mobile number" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
        <select name="municipality_id" required defaultValue="" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Select municipality</option>{(municipalities??[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select name="service_zone_id" required defaultValue="" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="" disabled>Select barangay / zone</option>{(serviceZones??[]).map(z=><option key={z.id} value={z.id}>{z.name} · {(municipalities??[]).find(m=>m.id===z.municipality_id)?.name ?? "Area"}</option>)}</select>
        <textarea name="address_line" required placeholder="House no., street, purok / sitio, barangay" className="min-h-24 rounded-xl border border-slate-200 px-3 py-3 text-sm sm:col-span-2"/>
        <input name="landmark" placeholder="Nearby landmark (optional)" className="rounded-xl border border-slate-200 px-3 py-3 text-sm sm:col-span-2"/>
        <FormSubmitButton pendingLabel="Saving address…" className="rounded-full bg-[#102e57] px-5 py-3 text-sm font-extrabold text-white sm:col-span-2">Save address</FormSubmitButton>
      </form>
    </section>
    <section className="mt-6 space-y-3"><h2 className="text-lg font-black">Saved addresses</h2>{(addresses??[]).length?(addresses??[]).map(a=><article key={a.id} className="rounded-2xl border border-orange-100 bg-white p-4"><p className="font-extrabold">{a.label} · {a.recipient_name}</p><p className="mt-1 text-sm text-slate-500">{a.address_line}, {(a.service_zones as unknown as {name:string}|null)?.name}, {(a.municipalities as unknown as {name:string}|null)?.name}</p><p className="text-sm text-slate-500">{a.recipient_phone} {a.landmark ? "· Near " + a.landmark : ""}</p></article>):<p className="rounded-xl bg-white p-5 text-sm text-slate-500">You have not saved a delivery address yet.</p>}</section>
  </div></main>;
}
