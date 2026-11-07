import Link from "next/link";
import { requestPasswordReset } from "./actions";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]"><div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
    <Link href="/login" className="text-sm font-extrabold text-orange-600">← Back to sign in</Link>
    <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Account recovery</p><h1 className="mt-2 text-3xl font-black">Reset your password</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Enter the email address associated with your SUGOMATE account. If it is registered, we’ll send a secure reset link.</p>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error === "invalid" ? "Enter a valid email address." : "We couldn't send the reset email. Please try again shortly."}</p>}
    {success === "requested" && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">If an account matches that email address, a reset link has been sent. Check your Inbox and Spam folders and use the latest email.</p>}
    <form action={requestPasswordReset} className="mt-7 space-y-4"><label className="block text-sm font-bold">Email address<input required name="email" type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label><AuthSubmitButton pendingLabel="Sending reset link…">Send reset link</AuthSubmitButton></form>
    <p className="mt-6 text-center text-sm text-slate-500">Remembered your password? <Link href="/login" className="font-extrabold text-orange-600">Sign in</Link></p>
  </div></main>;
}