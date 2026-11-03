"use client";

import { useFormStatus } from "react-dom";

export default function SignOutSubmitButton({ className = "" }: { className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}
    className={`inline-flex items-center justify-center gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-600 hover:shadow-md active:translate-y-0 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0 ${className}`}>
    {pending ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Signing out…</> : "Sign out"}
  </button>;
}
