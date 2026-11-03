import Link from "next/link";
import { signIn } from "./actions";
import PasswordField from "@/components/auth/PasswordField";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

const errors: Record<string, string> = {
  missing: "Enter your email and password.",
  credentials: "The email or password is incorrect.",
  confirmation: "The confirmation link could not be verified. Please request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff7ef] px-4 py-10 text-[#102e57]">
      <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-xl shadow-orange-100/60 sm:p-9">
        <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
        <div className="mt-7 text-center">
          <p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">Welcome back</p>
          <h1 className="mt-2 text-3xl font-black">Sign in to SUGOMATE</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Access your account to manage orders, deliveries, and more.</p>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errors[error] ?? "Unable to sign in. Please try again."}</p>}
        <form action={signIn} className="mt-7 space-y-4">
          <label className="block text-sm font-bold">Email address
            <input required name="email" type="email" autoComplete="email" placeholder="Enter your email address" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/>
          </label>
          <label className="block text-sm font-bold">Password
            <PasswordField name="password" placeholder="Enter your password" autoComplete="current-password"/>
          </label>
          <button className="w-full rounded-full bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-5 py-3.5 font-extrabold text-white transition hover:brightness-105">Sign in</button>
        </form>
        <div className="my-5 flex items-center gap-3 text-sm text-slate-500"><span className="h-px flex-1 bg-slate-200"/><span>or</span><span className="h-px flex-1 bg-slate-200"/></div>
        <GoogleSignInButton />
        <p className="mt-6 text-center text-sm text-slate-500">Don’t have an account? <Link href="/register" className="font-extrabold text-blue-600">Create account</Link></p>
      </div>
    </main>
  );
}
