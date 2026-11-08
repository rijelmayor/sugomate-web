import Link from "next/link";
import { verifyRegistrationPhone, resendRegistrationPhoneOtp } from "@/app/register/actions";
import FormSubmitButton from "@/components/FormSubmitButton";

const messages: Record<string,string> = {
  invalid: "That code is incorrect. You have up to five attempts.",
  expired: "Your code has expired. Request a new one.",
  locked: "Too many incorrect attempts. Request a new code after the cooldown.",
  missing: "There is no active verification code to resend. If you have already verified your mobile number, sign in to continue. Otherwise, return to registration and try again.",
  cooldown: "Please wait 60 seconds after the last send attempt before requesting another code.",
  save: "We couldn't save your verification. Please try again.",
  sms: "We couldn't send your SMS. Check the phone number and try again.",
};

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ email?: string; error?: string; success?: string; next?: string }> }) {
  const { email = "", error, success, next } = await searchParams;
  const safeNext=next?.startsWith("/")&&!next.startsWith("//")?next:"/dashboard";
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]">
    <div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
      <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link>
      <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Mobile verification</p>
      <h1 className="mt-2 text-3xl font-black">Verify your number</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Enter the six-digit code sent to your Philippine mobile number. The code expires in five minutes.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{messages[error] ?? messages.sms}</p>}
      {success === "resent" && <p role="status" className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">A new verification code has been sent.</p>}
      <form action={verifyRegistrationPhone} className="mt-7 space-y-4">
        <input type="hidden" name="email" value={email}/><input type="hidden" name="next" value={safeNext}/>
        <label className="block text-sm font-bold">Six-digit verification code<input required name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="000000" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl tracking-[.4em] outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <FormSubmitButton pendingLabel="Verifying…" className="w-full rounded-xl bg-[#102e57] px-4 py-3 font-bold text-white">Verify mobile number</FormSubmitButton>
      </form>
      <form action={resendRegistrationPhoneOtp} className="mt-3"><input type="hidden" name="email" value={email}/><input type="hidden" name="next" value={safeNext}/><FormSubmitButton pendingLabel="Sending…" className="w-full rounded-xl border border-orange-200 px-4 py-3 text-sm font-bold text-orange-700">Resend code</FormSubmitButton></form>
      <p className="mt-6 text-center text-sm text-slate-500">Already verified? <Link href={`/login?next=${encodeURIComponent(safeNext)}`} className="font-extrabold text-orange-600">Sign in</Link></p>
    </div>
  </main>;
}
