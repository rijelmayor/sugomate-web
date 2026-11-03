"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function continueWithGoogle() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (authError) {
      setError("Google sign-in is not available yet. Please use your email and password.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-5 py-3.5 font-bold text-[#102e57] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15Z"/>
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"/>
          <path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 17.9l6.9-5.2Z"/>
          <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z"/>
        </svg>
        {loading ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {error && <p role="alert" className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
