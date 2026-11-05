"use client";

import { useFormStatus } from "react-dom";

export default function FormSubmitButton({ children, className, pendingLabel, confirmMessage }: {
  children: React.ReactNode;
  className: string;
  pendingLabel?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return <button
    type="submit"
    disabled={pending}
    aria-busy={pending}
    onClick={confirmMessage ? event => { if (!pending && !window.confirm(confirmMessage)) event.preventDefault(); } : undefined}
    className={`${className} inline-flex items-center justify-center gap-2 transition active:scale-[.97] disabled:cursor-wait disabled:opacity-70`}>
    {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
    {pending ? (pendingLabel ?? "Please wait…") : children}
  </button>;
}
