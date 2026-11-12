import Link from "next/link";
import { signIn } from "./actions";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthIntro from "@/components/auth/AuthIntro";
import PasswordField from "@/components/auth/PasswordField";

const errors: Record<string, string> = {
  missing: "Enter your email and password.",
  credentials: "The email or password is incorrect.",
  confirmation: "Please complete mobile verification before signing in.",
  "missing-email": "Enter your email address in the sign-in form first.",
  resend: "We couldn't send a new confirmation email. Please try again shortly.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; next?: string }> }) {
  const { error, success, next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-8 text-[#102e57]">
    <AuthIntro>
    <div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
      <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
      <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Welcome back</p>
      <h1 className="mt-2 text-3xl font-black">Sign in to SUGOMATE</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Access your account to manage orders, your store, or delivery work.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errors[error] ?? "Unable to sign in. Please try again."}</p>}
      {success === "resent" && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">If the address is registered and still needs confirmation, a new confirmation email has been requested. Check your Inbox and Spam folders.</p>}{success === "phone-verified" && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900">Your mobile number is verified. Sign in to continue.</p>}
      <form action={signIn} className="mt-7 space-y-4"><input type="hidden" name="next" value={safeNext}/>
        <label className="block text-sm font-bold">Email address<input required name="email" type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-bold">Password<PasswordField name="password" autoComplete="current-password" minLength={1}/></label><div className="-mt-2 text-right"><Link href="/forgot-password" className="text-sm font-bold text-orange-600 hover:text-orange-700">Forgot password?</Link></div>
        <AuthSubmitButton pendingLabel="Signing you in…">Sign in</AuthSubmitButton>
      </form>
   </div>
    </AuthIntro>
  </main>;
}
