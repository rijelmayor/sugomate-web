import { walletCustomerContext } from "@/lib/wallet-server";
import { submitWalletTopup, requestWalletWithdrawal } from "./actions";

export const dynamic = "force-dynamic";

type PaymentInstruction = { payment_method: string; display_name: string; account_name: string; account_number: string; bank_name: string | null; instructions: string | null };
type WalletTransaction = { id: string; transaction_type: string; direction: string; amount: number | string; description: string | null; created_at: string };
type WalletRequest = { id: string; amount: number | string; status: string; created_at: string };
const peso = (value: number) => new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(value);

export default async function CustomerWalletPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const {user,db} = await walletCustomerContext();
  const params = await searchParams;
  const [{data:wallet},{data:transactions},{data:topups},{data:withdrawals},{data:instructions}] = await Promise.all([
    db.from("customer_wallets").select("available_balance,reserved_balance").eq("customer_id",user.id).maybeSingle(),
    db.from("wallet_transactions").select("id,transaction_type,direction,amount,description,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(30),
    db.from("wallet_top_up_requests").select("id,amount,payment_method,payment_reference,status,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(10),
    db.from("wallet_withdrawal_requests").select("id,amount,payout_method,status,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(10),
    db.from("wallet_payment_instructions").select("payment_method,display_name,account_name,account_number,bank_name,instructions").eq("is_enabled",true)
  ]);
  const available=Number(wallet?.available_balance??0), reserved=Number(wallet?.reserved_balance??0);
  const paymentInstructions = (instructions ?? []) as PaymentInstruction[];
  const walletTransactions = (transactions ?? []) as WalletTransaction[];
  const topupRequests = (topups ?? []) as (WalletRequest & { payment_method: string; payment_reference: string })[];
  const withdrawalRequests = (withdrawals ?? []) as (WalletRequest & { payout_method: string })[];
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <header><p className="text-sm font-semibold text-blue-700">SUGOMATE</p><h1 className="text-2xl font-bold">My Wallet</h1><p className="text-sm text-gray-500">Manage your balance, top-ups and withdrawals.</p></header>
    {params.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">We could not complete that request. Please check the details and try again.</p>}
    {(params.topup||params.withdrawal) && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">Your request has been submitted successfully.</p>}
    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-slate-900 p-5 text-white"><p className="text-sm text-slate-300">Available balance</p><p className="mt-2 text-3xl font-bold">{peso(available)}</p></div>
      <div className="rounded-2xl border p-5"><p className="text-sm text-gray-500">Reserved for withdrawals</p><p className="mt-2 text-3xl font-bold">{peso(reserved)}</p></div>
    </section>
    <section className="grid gap-5 md:grid-cols-2">
      <form action={submitWalletTopup} className="space-y-3 rounded-2xl border p-5">
        <h2 className="text-lg font-semibold">Top Up Wallet</h2><p className="text-sm text-gray-500">Submit your own payment request. Admin can only review the amount and proof you submit.</p>
        <label className="block text-sm">Amount (PHP)<input name="amount" type="number" min="1" max="100000" step="0.01" required className="mt-1 w-full rounded-lg border p-2"/></label>
        {paymentInstructions.length > 0 ? <label className="block text-sm">Payment method<select name="payment_method" required className="mt-1 w-full rounded-lg border p-2">{paymentInstructions.map((x)=><option key={x.payment_method} value={x.payment_method}>{x.display_name}</option>)}</select></label> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Top-ups are temporarily unavailable. SUGOMATE Admin has not configured an active payment method yet.</p>}
        {paymentInstructions.length > 0 && <div className="rounded-lg bg-slate-50 p-3 text-sm">{paymentInstructions.map((x)=><div key={x.payment_method} className="mb-2"><b>{x.display_name}</b><p>{x.account_name} · {x.account_number}</p>{x.bank_name&&<p>{x.bank_name}</p>}<p>{x.instructions}</p></div>)}</div>}
        <label className="block text-sm">Payment reference<input name="payment_reference" minLength={4} maxLength={120} required className="mt-1 w-full rounded-lg border p-2"/></label>
        <label className="block text-sm">Upload payment proof<input name="proof" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1 w-full rounded-lg border p-2"/></label>
        <button disabled={paymentInstructions.length===0} className="w-full rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Submit top-up request</button>
      </form>
      <form action={requestWalletWithdrawal} className="space-y-3 rounded-2xl border p-5">
        <h2 className="text-lg font-semibold">Request Withdrawal</h2><p className="text-sm text-gray-500">Funds are reserved immediately while Admin reviews your request. Rejected requests return to your available balance.</p>
        <label className="block text-sm">Amount (PHP)<input name="amount" type="number" min="1" max={available} step="0.01" required className="mt-1 w-full rounded-lg border p-2"/></label>
        <label className="block text-sm">Payout method<select name="payout_method" className="mt-1 w-full rounded-lg border p-2"><option value="gcash">GCash</option><option value="bank">Bank</option></select></label>
        <label className="block text-sm">Account name<input name="account_name" required className="mt-1 w-full rounded-lg border p-2"/></label>
        <label className="block text-sm">Account number<input name="account_number" required className="mt-1 w-full rounded-lg border p-2"/></label>
        <label className="block text-sm">Bank name (if applicable)<input name="bank_name" className="mt-1 w-full rounded-lg border p-2"/></label>
        <button disabled={available<=0} className="w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40">Request withdrawal</button>
      </form>
    </section>
    <section className="rounded-2xl border p-5"><h2 className="mb-3 text-lg font-semibold">Recent wallet activity</h2>{walletTransactions.length===0?<p className="text-sm text-gray-500">No wallet transactions yet.</p>:<div className="divide-y">{walletTransactions.map((x)=><div key={x.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{x.description||x.transaction_type.replaceAll("_"," ")}</p><p className="text-xs text-gray-500">{new Date(x.created_at).toLocaleString("en-PH")}</p></div><b className={x.direction==="credit"?"text-green-700":"text-slate-900"}>{x.direction==="credit"?"+":"−"}{peso(Number(x.amount))}</b></div>)}</div>}</section>
    <section className="grid gap-5 md:grid-cols-2"><div className="rounded-2xl border p-5"><h2 className="mb-3 font-semibold">Top-up requests</h2>{topupRequests.map((x)=><p key={x.id} className="border-b py-2 text-sm">{peso(Number(x.amount))} · {x.status.replaceAll("_"," ")} <span className="text-gray-500">· {new Date(x.created_at).toLocaleDateString("en-PH")}</span></p>)}</div><div className="rounded-2xl border p-5"><h2 className="mb-3 font-semibold">Withdrawal requests</h2>{withdrawalRequests.map((x)=><p key={x.id} className="border-b py-2 text-sm">{peso(Number(x.amount))} · {x.status} <span className="text-gray-500">· {new Date(x.created_at).toLocaleDateString("en-PH")}</span></p>)}</div></section>
  </main>;
}
