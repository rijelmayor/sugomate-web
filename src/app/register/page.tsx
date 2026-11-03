import Link from "next/link";
import { signUp } from "./actions";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
export default async function RegisterPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 return <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]"><div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
 <Link href="/" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link><p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Join the community</p><h1 className="mt-2 text-3xl font-black">Create your account</h1><p className="mt-2 text-sm leading-6 text-slate-500">Start with a customer account. You can apply to become a merchant or delivery partner after signing in.</p>
 {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error==="invalid"?"Enter your name, a valid Philippine mobile number, email, and a password of at least 8 characters.":"We could not complete registration. The email may already be registered, or SMS delivery is temporarily unavailable."}</p>}
 <form action={signUp} className="mt-7 space-y-4">
 <label className="block text-sm font-bold">Full name<input required name="display_name" autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
 <label className="block text-sm font-bold">Mobile number <span className="font-normal text-red-500">required</span><input required name="phone" type="tel" autoComplete="tel" placeholder="09XXXXXXXXX or +639XXXXXXXXX" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
 <label className="block text-sm font-bold">Email address<input required name="email" type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
 <label className="block text-sm font-bold">Password<input required name="password" type="password" minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/><span className="mt-1 block text-xs font-normal text-slate-400">At least 8 characters.</span></label>
 <AuthSubmitButton pendingLabel="Creating your account…">Create account</AuthSubmitButton></form>
 <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link href="/login" className="font-extrabold text-orange-600">Sign in</Link></p></div></main>;
}