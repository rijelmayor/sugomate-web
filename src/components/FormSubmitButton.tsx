"use client";

import { useFormStatus } from "react-dom";

export default function FormSubmitButton({ children, className, pendingLabel }: {
  children: React.ReactNode;
  className: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`${className} inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70`}>
    {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
    {pending ? (pendingLabel ?? "Please wait…") : children}
  </button>;
}
