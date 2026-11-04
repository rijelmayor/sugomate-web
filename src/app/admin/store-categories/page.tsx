import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalSignOut from "@/components/PortalSignOut";
import { assignMerchantCategory, saveMerchantCategory } from "./actions";

type Params = { error?: string; saved?: string; assigned?: string };

export default async function StoreCategoriesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!admin) redirect("/dashboard?error=admin-access");
  const [{ data: categories }, { data: merchants }] = await Promise.all([
    supabase.from("merchant_categories").select("id,name,slug,icon,sort_order,is_active").order("sort_order").order("name"),
    supabase.from("merchants").select("id,name,slug,status,category_id,merchant_categories(name)").order("name"),
  ]);
  return <main className="min-h-screen bg-[#f3f5f9] px-4 py-7 text-[#102b4e] sm:px-6">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">SUGOMATE / Admin</p><h1 className="mt-1 text-3xl font-black">Store categories</h1><p className="mt-1 text-sm text-slate-500">Create the types of businesses that can join the marketplace, then assign each merchant to a category.</p></div>
        <div className="flex flex-wrap items-center gap-2"><Link href="/admin" className="rounded-full bg-[#102b4e] px-5 py-3 text-sm font-bold text-white">Back to operations</Link><PortalSignOut className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold"/></div>
      </header>
      {(params.error || params.saved || params.assigned) && <p role="status" className={`mt-5 rounded-xl p-3 text-sm ${params.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>{params.error ? "The change could not be saved. Check that the name is unique and the fields are valid." : params.assigned ? "Merchant category updated." : "Store category saved."}</p>}
      <section className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black">Add a store category</h2>
          <form action={saveMerchantCategory} className="mt-4 space-y-3">
            <label className="block text-xs font-bold">Category name<input name="name" required minLength={2} maxLength={80} placeholder="e.g. Flower Shop" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
            <label className="block text-xs font-bold">Icon / emoji<input name="icon" defaultValue="🏪" maxLength={12} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
            <label className="block text-xs font-bold">Display order<input name="sort_order" type="number" min="0" step="1" defaultValue="0" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked/> Active in marketplace</label>
            <button className="w-full rounded-full bg-[#ff8a00] px-5 py-3 text-sm font-black text-white">Create category</button>
          </form>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-black">Existing store categories</h2>
          <div className="mt-4 space-y-3">
            {(categories ?? []).map(c => <form key={c.id} action={saveMerchantCategory} className="grid gap-2 rounded-2xl border border-slate-100 p-3 sm:grid-cols-[1fr_110px_90px_auto] sm:items-end">
              <input type="hidden" name="category_id" value={c.id}/>
              <label className="text-[11px] font-bold">Name<input name="name" required defaultValue={c.name} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label>
              <label className="text-[11px] font-bold">Icon<input name="icon" defaultValue={c.icon} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label>
              <label className="text-[11px] font-bold">Order<input name="sort_order" type="number" min="0" defaultValue={c.sort_order} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label>
              <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-[11px]"><input type="checkbox" name="is_active" defaultChecked={c.is_active}/> Active</label><button className="rounded-full bg-[#102b4e] px-3 py-2 text-xs font-bold text-white">Save</button></div>
            </form>)}
            {!categories?.length && <p className="text-sm text-slate-500">No categories created yet.</p>}
          </div>
        </div>
      </section>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-black">Assign categories to merchants</h2>
        <p className="mt-1 text-xs text-slate-500">Store categories describe the merchant business type. Product categories remain separate and are managed in the product catalogue.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {(merchants ?? []).map(m => <form key={m.id} action={assignMerchantCategory} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <input type="hidden" name="merchant_id" value={m.id}/>
            <div><p className="text-sm font-bold">{m.name}</p><p className="text-xs text-slate-500">{m.slug} · {m.status}</p></div>
            <div className="flex items-center gap-2"><select name="category_id" defaultValue={m.category_id ?? ""} className="max-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Uncategorized</option>{(categories ?? []).map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select><button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold">Assign</button></div>
          </form>)}
          {!merchants?.length && <p className="py-4 text-sm text-slate-500">No merchant applications yet.</p>}
        </div>
      </section>
    </div>
  </main>;
}
