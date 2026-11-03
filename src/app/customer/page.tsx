import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";
import CustomerMarketplace from "@/components/customer/CustomerMarketplace";
import { signOut } from "@/app/dashboard/actions";

type Search = { category?: string; municipality?: string; error?: string };

export default async function CustomerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: categories }, { data: municipalities }, { data: addresses }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("product_categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order"),
    supabase.from("municipalities").select("id,name").eq("is_serviceable", true).order("name"),
    supabase.from("customer_addresses").select("id,label,recipient_name,recipient_phone,address_line,municipalities(name)").eq("customer_id", user.id).order("created_at", { ascending: false }),
  ]);

  let productQuery = supabase.from("products")
    .select("id,name,description,price,image_url,merchant:merchants!products_merchant_id_fkey(name,slug),branch:merchant_branches!products_branch_id_fkey(name,municipality_id,municipalities(name)),category:product_categories!products_category_id_fkey(slug)")
    .eq("is_available", true)
    .order("created_at", { ascending: false })
    .limit(60);

  if (params.category) productQuery = productQuery.eq("category.slug", params.category);
  if (params.municipality) productQuery = productQuery.eq("branch.municipality_id", params.municipality);

  const { data: productRows, error } = await productQuery;
  const products = error ? [] : (productRows ?? []).map(row => ({
    ...row,
    price: Number(row.price),
    merchant: Array.isArray(row.merchant) ? row.merchant[0] : row.merchant,
    branch: Array.isArray(row.branch) ? row.branch[0] : row.branch,
  }));

  return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#fff7ef] px-4 py-6 text-[#102e57] sm:px-6 sm:py-8">
    <div className="mx-auto w-full min-w-0 max-w-7xl">
      <header className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex w-fit items-center gap-2 text-lg font-black tracking-tight text-[#102e57]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a00] to-[#ed3e17] text-xl text-white">S</span>SUGOMATE</Link>
        <nav aria-label="Customer navigation" className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <span className="col-span-2 hidden text-right text-sm text-slate-500 sm:block">Maayong adlaw, {profile?.display_name || "Customer"}</span>
          <Link href="/customer/orders" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#102e57] transition duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">Orders</Link>
          <Link href="/customer/addresses" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#102e57] transition duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">Addresses</Link>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#102e57] transition duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">My account</Link>
          <form action={signOut} className="min-w-0"><SignOutSubmitButton className="min-h-11 w-full rounded-xl bg-[#102e57] px-4 py-2 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#174777] hover:text-white hover:shadow-md active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2" /></form>
        </nav>
      </header>
      <CustomerMarketplace products={products as never} categories={categories ?? []} selectedCategory={params.category ?? ""} selectedMunicipality={params.municipality ?? ""} municipalities={municipalities ?? []} addresses={(addresses ?? []) as never} checkoutError={params.error}/>
      <footer className="mt-10 border-t border-orange-100 pt-5 text-center text-xs text-slate-400">SUGOMATE · Imong sugo, among ihatod.</footer>
    </div>
  </main>;
}
