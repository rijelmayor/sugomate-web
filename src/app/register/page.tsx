import Link from "next/link";
import { signUp } from "./actions";
import PasswordField from "@/components/auth/PasswordField";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff7ef] px-4 py-10 text-[#102e57]">
      <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-xl shadow-orange-100/60 sm:p-9">
        <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
        <div className="mt-7 text-center">
          <p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">Join the community</p>
          <h1 className="mt-2 text-3xl font-black">Create your account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Join SUGOMATE and start enjoying fast, reliable local services.</p>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error === "invalid" ? "Enter your name, a valid email, and a password of at least 8 characters." : "We could not create your account. The email may already be registered."}</p>}
        {success === "check-email" && <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">Account request received. Check your email for the confirmation link, then sign in.</p>}
        <form action={signUp} className="mt-7 space-y-4">
          <label className="block text-sm font-bold">Full name
            <input required name="display_name" autoComplete="name" placeholder="Enter your full name" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/>
          </label>
          <label className="block text-sm font-bold">Mobile number <span className="font-normal text-slate-400">(optional)</span>
            <input name="phone" type="tel" autoComplete="tel" placeholder="+63" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/>
          </label>
          <label className="block text-sm font-bold">Email address
            <input required name="email" type="email" autoComplete="email" placeholder="Enter your email address" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/>
          </label>
          <label className="block text-sm font-bold">Password
            <PasswordField name="password" placeholder="Create a password" autoComplete="new-password" minLength={8}/>
            <span className="mt-1 block text-xs font-normal text-slate-400">At least 8 characters.</span>
          </label>
          <button className="w-full rounded-full bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-5 py-3.5 font-extrabold text-white transition hover:brightness-105">Create account</button>
        </form>
        <div className="my-5 flex items-center gap-3 text-sm text-slate-500"><span className="h-px flex-1 bg-slate-200"/><span>or</span><span className="h-px flex-1 bg-slate-200"/></div>
        <GoogleSignInButton />
        <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-extrabold text-blue-600">Sign in</Link></p>
      </div>
    </main>
  );
}
