import Link from "next/link";
import { signIn, resendConfirmation } from "./actions";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";

const errors: Record<string, string> = {
  missing: "Enter your email and password.",
  credentials: "The email or password is incorrect.",
  confirmation: "Your email address is not confirmed yet. Confirm it before signing in. Check your inbox and spam folder, or request a new confirmation email below.",
  "missing-email": "Enter your email address in the sign-in form first.",
  resend: "We couldn't send a new confirmation email. Please try again shortly.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]">
    <div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
      <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
      <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Welcome back</p>
      <h1 className="mt-2 text-3xl font-black">Sign in to SUGOMATE</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Access your account to manage orders, your store, or delivery work.</p>
      {error === "confirmation" ? <section role="alert" className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-amber-200 text-lg" aria-hidden="true">✉</span>
          <div><h2 className="font-extrabold">Email confirmation required</h2><p className="mt-1 text-sm leading-6">Your account exists, but your email address has not been confirmed. Open the confirmation link we sent before signing in. Check your Inbox and Spam folders.</p></div>
        </div>
        <form action={resendConfirmation} className="mt-4 border-t border-amber-200 pt-3">
          <label className="block text-sm font-bold">Your registration email<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-3 font-normal text-[#102e57] outline-none focus:ring-2 focus:ring-amber-200"/></label>
          <div className="mt-3"><AuthSubmitButton pendingLabel="Sending confirmation link…">Resend confirmation email</AuthSubmitButton></div>
        </form>
      </section> : error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errors[error] ?? "Unable to sign in. Please try again."}</p>}
      {success === "resent" && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">If the address is registered and still needs confirmation, a new confirmation email has been requested. Check your Inbox and Spam folders.</p>}
      <form action={signIn} className="mt-7 space-y-4">
        <label className="block text-sm font-bold">Email address<input required name="email" type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-bold">Password<input required name="password" type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <AuthSubmitButton pendingLabel="Signing you in…">Sign in</AuthSubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">New to SUGOMATE? <Link href="/register" className="font-extrabold text-orange-600">Create an account</Link></p>
    </div>
  </main>;
}
