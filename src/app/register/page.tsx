import Link from "next/link";
import { signUp } from "./actions";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]">
    <div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
      <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
      <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Join the community</p>
      <h1 className="mt-2 text-3xl font-black">Create your account</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Start with a customer account. You can apply to become a merchant or delivery partner after signing in.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error === "invalid" ? "Enter your name, a valid email, and a password of at least 8 characters." : "We could not create your account. The email may already be registered."}</p>}
      {success === "check-email" && <section role="status" className="mt-5 rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 animate-bounce items-center justify-center rounded-full bg-orange-200 text-xl" aria-hidden="true">✉</span>
          <div><h2 className="text-base font-black text-[#102e57]">One last step — confirm your email</h2><p className="mt-1 text-sm leading-6 text-slate-700">We've requested a confirmation link for your email address. Open it to activate your SUGOMATE account before signing in. Check your Inbox and Spam folders.</p></div>
        </div>
      </section>}
      <form action={signUp} className="mt-7 space-y-4">
        <label className="block text-sm font-bold">Full name<input required name="display_name" autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-bold">Mobile number <span className="font-normal text-slate-400">(optional)</span><input name="phone" type="tel" autoComplete="tel" placeholder="+63" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-bold">Email address<input required name="email" type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-bold">Password<input required name="password" type="password" minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/><span className="mt-1 block text-xs font-normal text-slate-400">At least 8 characters.</span></label>
        <AuthSubmitButton pendingLabel="Creating your account…">Create account</AuthSubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link href="/login" className="font-extrabold text-orange-600">Sign in</Link></p>
    </div>
  </main>;
}
