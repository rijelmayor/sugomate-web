import Link from "next/link";
import { signIn } from "./actions";

const errors: Record<string, string> = {
  missing: "Enter your email and password.",
  credentials: "The email or password is incorrect.",
  confirmation: "The confirmation link could not be verified. Please request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]">
    <div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
      <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
      <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Welcome back</p>
      <h1 className="mt-2 text-3xl font-black">Sign in to SUGOMATE</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Access your account to manage orders, your store, or delivery work.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errors[error] ?? "Unable to sign in. Please try again."}</p>}
      <form action={signIn} className="mt-7 space-y-4">
        <label className="block text-sm font-bold">Email address<input required name="email" type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-bold">Password<input required name="password" type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <button className="w-full rounded-full bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-5 py-3.5 font-extrabold text-white">Sign in</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">New to SUGOMATE? <Link href="/register" className="font-extrabold text-orange-600">Create an account</Link></p>
    </div>
  </main>;
}
