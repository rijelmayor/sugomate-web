"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSent(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      // Initiate PKCE in the browser so its verifier cookie is stored on
      // the exact same host that receives the callback.
      const redirectTo = new URL(
        "/auth/callback?next=%2Freset-password",
        window.location.origin,
      ).toString();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      );

      if (resetError) {
        console.error("[password-reset] Supabase request failed:", resetError.message);
        setError("We couldn't send the reset email. Please try again shortly.");
        return;
      }
      setSent(true);
    } catch (cause) {
      console.error("[password-reset] Unexpected request failure:", cause);
      setError("We couldn't send the reset email. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {sent && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">If an account matches that email address, a reset link has been sent. Check your Inbox and Spam folders and use the latest email.</p>}
      <label className="block text-sm font-bold">
        Email address
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
      >
        {busy ? "Sending reset link…" : "Send reset link"}
      </button>
    </form>
  );
}
