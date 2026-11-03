"use client";

import { useFormStatus } from "react-dom";

export default function AuthSubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-live="polite"
      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#ff8a00] to-[#f0441c] px-5 py-3.5 font-extrabold text-white shadow-lg shadow-orange-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-200 disabled:cursor-wait disabled:opacity-80"
    >
      {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
      <span>{pending ? pendingLabel : children}</span>
      {!pending && <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>}
    </button>
  );
}
