"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/auth/PasswordInput";

export default function ResetPasswordForm() {
  const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [done,setDone]=useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if(password.length<8) return setMessage("Your password must be at least 8 characters.");
    if(password!==confirm) return setMessage("The passwords do not match.");
    setBusy(true); const supabase=createClient();
    const {data:{user},error:sessionError}=await supabase.auth.getUser();
    if(sessionError||!user){setBusy(false);setMessage("This reset link is invalid or has expired. Request a new password-reset email.");return;}
    const {error}=await supabase.auth.updateUser({password}); setBusy(false);
    if(error){setMessage("We couldn't update your password. The reset link may have expired; request a new one.");return;}
    setDone(true); await supabase.auth.signOut();
  }
  return <main className="min-h-screen bg-[#fff7ef] px-4 py-12 text-[#102e57]"><div className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100/60">
    <Link href="/login" className="text-sm font-extrabold text-orange-600">← SUGOMATE</Link><p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-orange-600">Account recovery</p><h1 className="mt-2 text-3xl font-black">Choose a new password</h1>
    {done ? <div className="mt-5"><p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">Your password has been updated. Please sign in using your new password.</p><Link href="/login" className="mt-5 block rounded-xl bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-4 py-3 text-center text-sm font-extrabold text-white">Return to sign in</Link></div> :
    <><p className="mt-2 text-sm leading-6 text-slate-500">Create a new password using at least 8 characters.</p>{message&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    <form onSubmit={submit} className="mt-7 space-y-4"><PasswordInput label="New password" inputProps={{ required: true, minLength: 8, autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full rounded-xl border border-slate-200 px-4 py-3 pr-14 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" }} /><PasswordInput label="Confirm new password" inputProps={{ required: true, minLength: 8, autoComplete: "new-password", value: confirm, onChange: (e) => setConfirm(e.target.value), className: "w-full rounded-xl border border-slate-200 px-4 py-3 pr-14 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" }} /><button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy?"Updating password…":"Update password"}</button></form></>}
  </div></main>;
}