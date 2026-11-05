import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveMerchantStorefront } from "./settings-actions";
import MerchantShell from "@/components/merchant/MerchantShell";
import StoreLogoPicker from "@/components/merchant/StoreLogoPicker";
import FormSubmitButton from "@/components/FormSubmitButton";

const days = [
  ["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],["thu","Thursday"],
  ["fri","Friday"],["sat","Saturday"],["sun","Sunday"],
] as const;
const defaultHours = { open: "08:00", close: "20:00", closed: false };

export default async function MerchantStorefrontPage({ searchParams }: { searchParams: Promise<{saved?:string;error?:string;branch?:string}> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: memberships } = await supabase.from("merchant_members")
    .select("merchant_id,merchants(id,name,status,logo_url,accepted_payment_methods,gcash_qr_url)")
    .eq("user_id", user.id);
  const stores = (memberships ?? []).map(row => ({
    id: row.merchant_id,
    merchant: row.merchants as unknown as {id:string;name:string;status:string;logo_url:string|null;accepted_payment_methods:string[];gcash_qr_url:string|null}|null,
  })).filter(row => row.merchant?.status === "approved");
  const ids = stores.map(row => row.id);
  const { data: branches } = ids.length ? await supabase.from("merchant_branches")
    .select("id,merchant_id,name,store_hours,is_temporarily_closed,is_active")
    .in("merchant_id", ids).order("created_at") : {data:[]};
  const selected = branches?.find(item => item.id === params.branch) ?? branches?.[0];
  const merchant = stores.find(row => row.id === selected?.merchant_id)?.merchant;
  const hours = (selected?.store_hours ?? {}) as Record<string,{open?:string;close?:string;closed?:boolean}>;
  const methods = merchant?.accepted_payment_methods ?? ["cod"];
  const errorText: Record<string,string> = {
    branch:"No valid branch was selected.", permission:"You do not have access to update this store.",
    hours:"Please check the opening and closing times. Closing time must be later than opening time.",
    payment:"Select at least one accepted payment method.", logo:"Logo upload failed. Use a JPG, PNG or WebP image. Other settings were saved.", qr:"QR upload failed. Use a PNG, JPG or WebP image up to 5 MB.",
    "qr-required":"Upload the GCash QR image before enabling GCash.", save:"We could not save the storefront settings. Please try again.",
  };
  const shellStore = merchant ?? stores[0]?.merchant ?? null;
  return <MerchantShell active="settings" width="max-w-4xl" store={shellStore ? { name: shellStore.name, logoUrl: shellStore.logo_url } : null}>
      <div className="mt-5"><h1 className="text-2xl font-black sm:text-3xl">Store settings</h1><p className="mt-1 text-sm text-slate-500">Your logo, opening hours and payment options.</p></div>
      {params.saved && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Store settings saved.</p>}
      {params.error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{errorText[params.error] ?? "Unable to save settings."}</p>}
      {(branches ?? []).length > 1 && <nav aria-label="Choose branch" className="mt-5 flex flex-wrap gap-2">{(branches ?? []).map(item => <Link key={item.id} href={"/merchant/storefront?branch="+item.id} className={"rounded-full px-4 py-2 text-sm font-bold "+(item.id===selected?.id?"bg-[#102e57] text-white":"border border-orange-100 bg-white text-[#102e57]")}>{item.name}</Link>)}</nav>}
      {!selected || !merchant ? <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-black">No approved branch available</h2><p className="mt-2 text-sm">Create a branch and wait for store approval before configuring its storefront.</p><Link href="/merchant/products" className="mt-4 inline-flex rounded-full bg-[#102e57] px-5 py-3 text-sm font-bold text-white">Manage branches</Link></section> : <form action={saveMerchantStorefront} encType="multipart/form-data" className="mt-6 space-y-5">
        <input type="hidden" name="merchant_id" value={merchant.id}/><input type="hidden" name="branch_id" value={selected.id}/><input type="hidden" name="existing_gcash_qr_url" value={merchant.gcash_qr_url ?? ""}/>
        <section className="rounded-3xl border border-orange-100 bg-white p-5 sm:p-6"><h2 className="text-lg font-black">Store logo</h2><p className="mt-1 text-sm text-slate-500">Shown to customers next to your store name.</p><StoreLogoPicker name={merchant.name} initialUrl={merchant.logo_url ?? ""} /></section>
        <section className="rounded-3xl border border-orange-100 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-orange-600">Store branch</p><h2 className="mt-1 text-xl font-black">{merchant.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.name}</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">Philippine time · UTC+8</span></div>
          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-4"><input type="checkbox" name="temporarily_closed" defaultChecked={selected.is_temporarily_closed} className="mt-1 h-4 w-4 accent-orange-500"/><span><strong className="block text-sm">Temporarily close my store</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Customers can still see your store, but they cannot place orders until you reopen it.</span></span></label>
          <h3 className="mt-6 font-black">Weekly operating hours</h3><p className="mt-1 text-xs text-slate-500">During testing, new branches start at 8:00 AM–8:00 PM every day. Adjust each day to your actual schedule.</p>
          <div className="mt-4 space-y-2">{days.map(([key,label])=>{const slot={...defaultHours,...(hours[key]??{})};return <div key={key} className="grid grid-cols-[minmax(76px,1fr)_minmax(92px,1fr)_minmax(92px,1fr)_auto] items-center gap-2 rounded-xl bg-slate-50 p-3"><strong className="text-sm">{label}</strong><input aria-label={label+" opens"} type="time" name={key+"_open"} defaultValue={slot.open} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm disabled:opacity-40"/><input aria-label={label+" closes"} type="time" name={key+"_close"} defaultValue={slot.close} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm disabled:opacity-40"/><label className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" name={key+"_closed"} defaultChecked={slot.closed} className="accent-orange-500"/> Closed</label></div>})}</div>
        </section>
        <section className="rounded-3xl border border-orange-100 bg-white p-5 sm:p-6"><h2 className="text-lg font-black">Accepted payment methods</h2><p className="mt-1 text-sm text-slate-500">Customers will only see the payment options your store accepts.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" name="payment_method" value="cod" defaultChecked={methods.includes("cod")} className="h-4 w-4 accent-orange-500"/><span><strong className="block text-sm">Cash on delivery</strong><span className="text-xs text-slate-500">Customer pays upon delivery.</span></span></label><label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" name="payment_method" value="gcash" defaultChecked={methods.includes("gcash")} className="h-4 w-4 accent-orange-500"/><span><strong className="block text-sm">GCash</strong><span className="text-xs text-slate-500">Customer scans your payment QR.</span></span></label></div>
          <div className="mt-4 rounded-2xl bg-orange-50 p-4"><label className="block text-sm font-bold">GCash QR code <span className="font-normal text-slate-500">(required when GCash is enabled)</span><input type="file" name="gcash_qr" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#102e57] file:px-4 file:py-2 file:text-xs file:font-bold file:text-white"/></label>{merchant.gcash_qr_url && <div className="mt-3 flex items-center gap-3"><img src={merchant.gcash_qr_url} alt="Current GCash QR code" className="h-24 w-24 rounded-xl border border-orange-100 bg-white object-contain p-1"/><p className="text-xs text-slate-600">Current QR code. Upload a new image to replace it.</p></div>}</div>
        </section>
        <FormSubmitButton pendingLabel="Saving store settings…" className="w-full rounded-full bg-[#102e57] px-6 py-4 text-sm font-black text-white sm:w-auto">Save store settings</FormSubmitButton>
      </form>}
    </MerchantShell>;
}
