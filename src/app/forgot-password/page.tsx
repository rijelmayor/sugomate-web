import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]">
      <div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
        <Link href="/login" className="text-sm font-extrabold text-orange-600">← Back to sign in</Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Account recovery</p>
        <h1 className="mt-2 text-3xl font-black">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Enter the email address associated with your SUGOMATE account. If it is registered, we’ll send a secure reset link.</p>
        {error === "recovery" && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">This reset link could not be verified or has expired. Please request a new reset link using this same browser.</p>}
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm text-slate-500">Remembered your password? <Link href="/login" className="font-extrabold text-orange-600">Sign in</Link></p>
      </div>
    </main>
  );
}
